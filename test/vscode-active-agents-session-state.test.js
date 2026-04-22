const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const sessionScript = path.join(repoRoot, 'scripts', 'agent-session-state.js');
const installScript = path.join(repoRoot, 'scripts', 'install-vscode-active-agents-extension.js');
const sessionSchema = require(path.join(
  repoRoot,
  'templates',
  'vscode',
  'guardex-active-agents',
  'session-schema.js',
));
const extensionEntry = path.join(repoRoot, 'templates', 'vscode', 'guardex-active-agents', 'extension.js');

function runNode(scriptPath, args, options = {}) {
  return cp.spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

function runGit(repoPath, args, options = {}) {
  const result = cp.spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    ...options,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initGitRepo(repoPath) {
  fs.mkdirSync(repoPath, { recursive: true });
  runGit(repoPath, ['init']);
  runGit(repoPath, ['config', 'user.email', 'guardex-tests@example.com']);
  runGit(repoPath, ['config', 'user.name', 'Guardex Tests']);
}

function setPathMtime(filePath, whenMs) {
  const when = new Date(whenMs);
  fs.utimesSync(filePath, when, when);
}

function writeSessionRecord(repoRoot, record) {
  const sessionPath = sessionSchema.sessionFilePathForBranch(repoRoot, record.branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return sessionPath;
}

function loadExtensionWithMockVscode(mockVscode, mockSessionSchema = null) {
  const Module = require('node:module');
  const originalLoad = Module._load;
  delete require.cache[require.resolve(extensionEntry)];

  Module._load = function patchedModuleLoad(request, parent, isMain) {
    if (request === 'vscode') {
      return mockVscode;
    }
    if (mockSessionSchema && request === './session-schema.js' && parent?.filename === extensionEntry) {
      return mockSessionSchema;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(extensionEntry);
  } finally {
    Module._load = originalLoad;
  }
}

function createMockVscode(tempRoot) {
  const registrations = {
    providers: [],
    decorationProviders: [],
    treeViews: [],
    commands: new Map(),
    executedCommands: [],
    sourceControls: [],
    terminals: [],
    openedDocuments: [],
    shownDocuments: [],
    infoMessages: [],
    inputResponses: [],
    quickPickCalls: [],
    quickPickResponse: undefined,
    informationMessages: [],
    errorMessages: [],
    warningMessages: [],
    fileWatchers: [],
    watchers: [],
    workspaceFolderListeners: [],
  };

  class TreeItem {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }

  class ThemeIcon {
    constructor(id) {
      this.id = id;
    }
  }

  class ThemeColor {
    constructor(id) {
      this.id = id;
    }
  }

  class EventEmitter {
    constructor() {
      this.fireCount = 0;
      this.listeners = [];
      this.event = (listener, thisArg, disposables) => {
        const boundListener = thisArg ? listener.bind(thisArg) : listener;
        this.listeners.push(boundListener);
        const registration = {
          dispose: () => {
            this.listeners = this.listeners.filter((entry) => entry !== boundListener);
          },
        };
        if (Array.isArray(disposables)) {
          disposables.push(registration);
        }
        return registration;
      };
    }

    fire(event) {
      this.fireCount += 1;
      for (const listener of [...this.listeners]) {
        listener(event);
      }
    }
  }

  const disposable = (onDispose) => ({ dispose: onDispose || (() => {}) });

  function createFileWatcher(pattern) {
    const listeners = {
      create: [],
      change: [],
      delete: [],
    };

    const watcher = {
      disposed: false,
      pattern,
      onDidCreate(callback, thisArg) {
        listeners.create.push({ callback, thisArg });
        return disposable();
      },
      onDidChange(callback, thisArg) {
        listeners.change.push({ callback, thisArg });
        return disposable();
      },
      onDidDelete(callback, thisArg) {
        listeners.delete.push({ callback, thisArg });
        return disposable();
      },
      fireCreate(uri) {
        for (const listener of listeners.create) {
          listener.callback.call(listener.thisArg, uri);
        }
      },
      fireChange(uri) {
        for (const listener of listeners.change) {
          listener.callback.call(listener.thisArg, uri);
        }
      },
      fireDelete(uri) {
        for (const listener of listeners.delete) {
          listener.callback.call(listener.thisArg, uri);
        }
      },
      dispose() {
        watcher.disposed = true;
      },
    };
    registrations.watchers.push(watcher);
    registrations.fileWatchers.push(watcher);
    return watcher;
  }

  return {
    registrations,
    vscode: {
      TreeItem,
      ThemeIcon,
      EventEmitter,
      TreeItemCollapsibleState: {
        None: 0,
        Expanded: 1,
      },
      commands: {
        executeCommand: async (command, ...args) => {
          registrations.executedCommands.push({ command, args });
          if (command === 'setContext') {
            return undefined;
          }
          const handler = registrations.commands.get(command);
          if (handler) {
            return handler(...args);
          }
          return undefined;
        },
        registerCommand: (command, handler) => {
          registrations.commands.set(command, handler);
          return disposable(() => registrations.commands.delete(command));
        },
      },
      scm: {
        createSourceControl: (id, label) => {
          const sourceControl = {
            id,
            label,
            inputBox: {
              value: '',
              placeholder: '',
              enabled: true,
              visible: true,
            },
            acceptInputCommand: undefined,
            dispose() {},
          };
          registrations.sourceControls.push(sourceControl);
          return sourceControl;
        },
      },
      Uri: {
        file: (fsPath) => ({
          scheme: 'file',
          fsPath,
          path: fsPath,
          toString() {
            return `file://${fsPath}`;
          },
        }),
        parse: (value) => {
          const parsed = new URL(value);
          return {
            scheme: parsed.protocol.replace(/:$/, ''),
            authority: parsed.host,
            path: parsed.pathname,
            toString() {
              return value;
            },
          };
        },
      },
      window: {
        showInformationMessage: async (...args) => {
          registrations.infoMessages.push(args);
          if (typeof args[0] === 'string') {
            registrations.informationMessages.push(args[0]);
          }
          return undefined;
        },
        showErrorMessage: async (message) => {
          registrations.errorMessages.push(message);
          return undefined;
        },
        showWarningMessage: async (...args) => {
          registrations.warningMessages.push(args);
          return undefined;
        },
        showInputBox: async () => registrations.inputResponses.shift(),
        showQuickPick: async (items, options) => {
          registrations.quickPickCalls.push({ items, options });
          return registrations.quickPickResponse;
        },
        createTerminal: (options) => {
          const terminal = {
            options,
            shown: false,
            sentTexts: [],
            show() {
              this.shown = true;
            },
            sendText(text, addNewLine) {
              this.sentTexts.push({ text, addNewLine });
            },
            dispose() {},
          };
          registrations.terminals.push(terminal);
          return terminal;
        },
        showTextDocument: async (document, options) => {
          registrations.shownDocuments.push({ document, options });
          return { document };
        },
        createTreeView: (viewId, options) => {
          const selectionListeners = [];
          const treeView = {
            viewId,
            options,
            badge: undefined,
            message: undefined,
            onDidChangeSelection(listener) {
              selectionListeners.push(listener);
              return disposable();
            },
            fireSelection(selection) {
              for (const listener of selectionListeners) {
                listener({ selection });
              }
            },
            dispose() {},
          };
          registrations.treeViews.push(treeView);
          registrations.providers.push({ viewId, provider: options.treeDataProvider });
          return treeView;
        },
        registerFileDecorationProvider: (provider) => {
          registrations.decorationProviders.push(provider);
          return disposable();
        },
        registerTreeDataProvider: (viewId, provider) => {
          registrations.providers.push({ viewId, provider });
          return disposable();
        },
      },
      workspace: {
        openTextDocument: async (options) => {
          const document = {
            ...options,
            uri: { scheme: 'untitled' },
          };
          registrations.openedDocuments.push(document);
          return document;
        },
        createFileSystemWatcher: (pattern) => createFileWatcher(pattern),
        findFiles: async () => [],
        onDidChangeWorkspaceFolders: (listener) => {
          registrations.workspaceFolderListeners.push(listener);
          return disposable(() => {
            const index = registrations.workspaceFolderListeners.indexOf(listener);
            if (index >= 0) {
              registrations.workspaceFolderListeners.splice(index, 1);
            }
          });
        },
        workspaceFolders: [{ uri: { fsPath: tempRoot } }],
      },
      ThemeColor,
    },
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test('agent-session-state writes and removes active session records', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-'));
  const branch = 'agent/codex/demo-task';
  const worktreePath = path.join(tempRoot, '.omx', 'agent-worktrees', 'agent__codex__demo-task');
  fs.mkdirSync(worktreePath, { recursive: true });

  const start = runNode(sessionScript, [
    'start',
    '--repo',
    tempRoot,
    '--branch',
    branch,
    '--task',
    'demo-task',
    '--agent',
    'codex',
    '--worktree',
    worktreePath,
    '--pid',
    String(process.pid),
    '--cli',
    'codex',
    '--task-mode',
    'caveman',
    '--openspec-tier',
    'T1',
    '--routing-reason',
    'explicit lightweight prefix',
  ]);
  assert.equal(start.status, 0, start.stderr);

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, branch);
  assert.equal(path.basename(sessionPath), 'agent__codex__demo-task.json');
  assert.equal(fs.existsSync(sessionPath), true);

  const parsed = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  assert.equal(parsed.branch, branch);
  assert.equal(parsed.taskName, 'demo-task');
  assert.equal(parsed.agentName, 'codex');
  assert.equal(parsed.worktreePath, worktreePath);
  assert.equal(parsed.taskMode, 'caveman');
  assert.equal(parsed.openspecTier, 'T1');
  assert.equal(parsed.taskRoutingReason, 'explicit lightweight prefix');

  const sessions = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].label, 'agent__codex__demo-task');
  assert.equal(sessions[0].taskMode, 'caveman');
  assert.equal(sessions[0].openspecTier, 'T1');

  const stop = runNode(sessionScript, [
    'stop',
    '--repo',
    tempRoot,
    '--branch',
    branch,
  ]);
  assert.equal(stop.status, 0, stop.stderr);
  assert.equal(fs.existsSync(sessionPath), false);
});

test('session-schema ignores stale or invalid session records', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-stale-'));
  const activeSessionsDir = sessionSchema.activeSessionsDirForRepo(tempRoot);
  fs.mkdirSync(activeSessionsDir, { recursive: true });

  const liveRecord = sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/live-task',
    taskName: 'live-task',
    agentName: 'codex',
    worktreePath: path.join(tempRoot, '.omx', 'agent-worktrees', 'live-task'),
    pid: process.pid,
    cliName: 'codex',
  });
  fs.writeFileSync(
    sessionSchema.sessionFilePathForBranch(tempRoot, liveRecord.branch),
    `${JSON.stringify(liveRecord, null, 2)}\n`,
    'utf8',
  );

  const staleRecord = sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/stale-task',
    taskName: 'stale-task',
    agentName: 'codex',
    worktreePath: path.join(tempRoot, '.omx', 'agent-worktrees', 'stale-task'),
    pid: 999999,
    cliName: 'codex',
  });
  fs.writeFileSync(
    sessionSchema.sessionFilePathForBranch(tempRoot, staleRecord.branch),
    `${JSON.stringify(staleRecord, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(activeSessionsDir, 'broken.json'), '{broken json', 'utf8');

  const sessions = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].branch, liveRecord.branch);

  const sessionsIncludingStale = sessionSchema.readActiveSessions(tempRoot, { includeStale: true });
  assert.equal(sessionsIncludingStale.length, 2);
  assert.equal(
    sessionsIncludingStale.find((session) => session.branch === staleRecord.branch)?.activityKind,
    'dead',
  );
});

test('session-schema derives working activity from dirty sandbox worktrees', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-working-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');
  fs.writeFileSync(path.join(worktreePath, 'new-file.txt'), 'new\n', 'utf8');

  const record = sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/working-task',
    taskName: 'working-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
  });
  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, record.branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  const [session] = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(session.activityKind, 'working');
  assert.equal(session.changeCount, 2);
  assert.equal(session.activityCountLabel, '2 files');
  assert.deepEqual(session.changedPaths, ['sandbox/new-file.txt', 'sandbox/tracked.txt']);
  assert.equal(session.activitySummary, 'new-file.txt, tracked.txt');
});

test('session-schema derives blocked activity from git markers in the worktree git dir', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-blocked-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, '.git', 'MERGE_HEAD'), 'deadbeef\n', 'utf8');

  const session = sessionSchema.deriveSessionActivity(sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/blocked-task',
    taskName: 'blocked-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
  }));

  assert.equal(session.activityKind, 'blocked');
  assert.equal(session.activitySummary, 'Merge in progress.');
});

test('session-schema derives idle and stalled activity from clean worktree mtimes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-idle-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  const trackedPath = path.join(worktreePath, 'tracked.txt');
  initGitRepo(worktreePath);
  fs.writeFileSync(trackedPath, 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const record = sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/idle-task',
    taskName: 'idle-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
  });
  const now = Date.parse('2026-04-22T10:00:00.000Z');

  setPathMtime(trackedPath, now - 45_000);
  const idleSession = sessionSchema.deriveSessionActivity(record, { now });
  assert.equal(idleSession.activityKind, 'idle');
  assert.match(idleSession.activitySummary, /Recent file activity 45s ago\./);
  assert.equal(idleSession.lastFileActivityAt, new Date(now - 45_000).toISOString());

  setPathMtime(trackedPath, now - (20 * 60 * 1000));
  const stalledSession = sessionSchema.deriveSessionActivity(record, { now });
  assert.equal(stalledSession.activityKind, 'stalled');
  assert.match(stalledSession.activitySummary, /No file activity for 20m 0s\./);
  assert.equal(stalledSession.lastFileActivityAt, new Date(now - (20 * 60 * 1000)).toISOString());
});

test('session-schema derives dead activity when the recorded pid is not alive', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-dead-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const session = sessionSchema.deriveSessionActivity(sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/dead-task',
    taskName: 'dead-task',
    agentName: 'codex',
    worktreePath,
    pid: 999999,
    cliName: 'codex',
  }));

  assert.equal(session.activityKind, 'dead');
  assert.equal(session.activitySummary, 'Recorded PID is not alive.');
  assert.equal(session.pidAlive, false);
});

test('session-schema derives repo change rows from root git status', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-root-status-'));
  initGitRepo(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'tracked.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);

  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\nchanged\n', 'utf8');
  fs.writeFileSync(path.join(tempRoot, 'new-file.txt'), 'new\n', 'utf8');

  const changes = sessionSchema.readRepoChanges(tempRoot);
  assert.deepEqual(
    changes.map((change) => [change.relativePath, change.statusLabel]),
    [
      ['new-file.txt', 'U'],
      ['tracked.txt', 'M'],
    ],
  );
});

test('install-vscode-active-agents-extension installs the current extension version and prunes older copies', () => {
  const tempExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-ext-'));
  const staleDir = path.join(tempExtensionsDir, 'recodeee.gitguardex-active-agents-0.0.0');
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'stale.txt'), 'old', 'utf8');

  const result = runNode(installScript, ['--extensions-dir', tempExtensionsDir], {
    cwd: repoRoot,
  });
  assert.equal(result.status, 0, result.stderr);

  const installedDir = path.join(tempExtensionsDir, 'recodeee.gitguardex-active-agents-0.0.1');
  assert.equal(fs.existsSync(installedDir), true);
  assert.equal(fs.existsSync(path.join(installedDir, 'extension.js')), true);
  assert.equal(fs.existsSync(path.join(installedDir, 'session-schema.js')), true);
  assert.equal(fs.existsSync(staleDir), false);
  assert.match(result.stdout, /Reload the VS Code window/);
});

test('active-agents extension registers tree and decoration providers', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-view-'));
  const { registrations, vscode } = createMockVscode(tempRoot);
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  assert.equal(registrations.treeViews.length, 1);
  assert.equal(registrations.sourceControls.length, 1);
  assert.equal(registrations.treeViews[0].viewId, 'gitguardex.activeAgents');
  assert.equal(registrations.sourceControls[0].label, 'Active Agents Commit');
  assert.equal(
    registrations.sourceControls[0].inputBox.placeholder,
    'Pick an Active Agents session to commit its worktree.',
  );
  assert.equal(registrations.providers.length, 1);
  assert.equal(registrations.providers[0].viewId, 'gitguardex.activeAgents');
  assert.equal(registrations.decorationProviders.length, 1);
  assert.equal(registrations.fileWatchers.length, 2);
  assert.deepEqual(
    registrations.fileWatchers.map((watcher) => watcher.pattern),
    [
      '**/.omx/state/active-sessions/*.json',
      '**/.omx/state/agent-file-locks.json',
    ],
  );
  assert.equal(registrations.workspaceFolderListeners.length, 1);

  const provider = registrations.providers[0].provider;
  assert.equal(typeof provider.getTreeItem, 'function');
  assert.equal(typeof registrations.commands.get('gitguardex.activeAgents.startAgent'), 'function');

  const rootItems = await provider.getChildren();
  assert.equal(rootItems.length, 1);
  assert.equal(rootItems[0].label, 'No active Guardex agents');
  assert.equal(registrations.treeViews[0].badge, undefined);
  assert.equal(registrations.treeViews[0].message, 'Start a sandbox session to populate this view.');

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension startAgent command prompts and runs gx branch start in a terminal', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-start-agent-'));
  const { registrations, vscode } = createMockVscode(tempRoot);
  registrations.inputResponses.push('demo task', 'codex');
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);

  await registrations.commands.get('gitguardex.activeAgents.startAgent')();

  assert.equal(registrations.terminals.length, 1);
  assert.deepEqual(registrations.terminals[0].options, {
    name: `GitGuardex: ${path.basename(tempRoot)}`,
    cwd: tempRoot,
  });
  assert.equal(registrations.terminals[0].shown, true);
  assert.deepEqual(registrations.terminals[0].sentTexts, [
    {
      text: "gx branch start 'demo task' 'codex'",
      addNewLine: true,
    },
  ]);
  assert.deepEqual(registrations.quickPickCalls, []);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension groups live sessions under a repo node', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-live-view-'));
  const sessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/live-task',
    taskName: 'live-task',
    agentName: 'codex',
    worktreePath: path.join(tempRoot, '.omx', 'agent-worktrees', 'live-task'),
    pid: process.pid,
    cliName: 'codex',
  }));

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  assert.equal(repoItem.label, path.basename(tempRoot));
  assert.equal(repoItem.description, '1 active');

  const [agentsSection] = await provider.getChildren(repoItem);
  assert.equal(agentsSection.label, 'ACTIVE AGENTS');
  assert.equal(agentsSection.description, '1');

  const [idleSection] = await provider.getChildren(agentsSection);
  assert.equal(idleSection.label, 'IDLE');

  const [sessionItem] = await provider.getChildren(idleSection);
  assert.equal(sessionItem.label, 'live-task 🔒 0');
  assert.match(sessionItem.description, /^idle · \d+[smhd]/);
  assert.equal(sessionItem.iconPath.id, 'loading~spin');
  assert.equal(sessionItem.resourceUri.scheme, 'gitguardex-agent');
  assert.equal(
    sessionItem.resourceUri.toString(),
    `gitguardex-agent://${sessionSchema.sanitizeBranchForFile('agent/codex/live-task')}`,
  );
  assert.deepEqual(registrations.treeViews[0].badge, {
    value: 1,
    tooltip: '1 active agent',
  });
  assert.equal(registrations.treeViews[0].message, undefined);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension decorates idle clean sessions without overriding working rows', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-idle-decorations-'));

  const idleWarningPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-idle-warning-'));
  initGitRepo(idleWarningPath);
  fs.writeFileSync(path.join(idleWarningPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(idleWarningPath, ['add', 'tracked.txt']);
  runGit(idleWarningPath, ['commit', '-m', 'baseline']);

  const idleErrorPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-idle-error-'));
  initGitRepo(idleErrorPath);
  fs.writeFileSync(path.join(idleErrorPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(idleErrorPath, ['add', 'tracked.txt']);
  runGit(idleErrorPath, ['commit', '-m', 'baseline']);

  const workingPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-idle-working-'));
  initGitRepo(workingPath);
  fs.writeFileSync(path.join(workingPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(workingPath, ['add', 'tracked.txt']);
  runGit(workingPath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(workingPath, 'tracked.txt'), 'base\nchanged\n', 'utf8');

  const sessionRecords = [
    {
      branch: 'agent/codex/idle-warning',
      worktreePath: idleWarningPath,
      startedAt: new Date(Date.now() - (11 * 60 * 1000)).toISOString(),
    },
    {
      branch: 'agent/codex/idle-error',
      worktreePath: idleErrorPath,
      startedAt: new Date(Date.now() - (31 * 60 * 1000)).toISOString(),
    },
    {
      branch: 'agent/codex/working-now',
      worktreePath: workingPath,
      startedAt: new Date(Date.now() - (31 * 60 * 1000)).toISOString(),
    },
  ];

  for (const record of sessionRecords) {
    const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, record.branch);
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(
      sessionPath,
      `${JSON.stringify(sessionSchema.buildSessionRecord({
        repoRoot: tempRoot,
        branch: record.branch,
        taskName: path.basename(record.worktreePath),
        agentName: 'codex',
        worktreePath: record.worktreePath,
        pid: process.pid,
        cliName: 'codex',
        startedAt: record.startedAt,
      }), null, 2)}\n`,
      'utf8',
    );
  }

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => sessionRecords.map((record) => ({
    fsPath: sessionSchema.sessionFilePathForBranch(tempRoot, record.branch),
  }));
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  await provider.getChildren();
  const decorationProvider = registrations.decorationProviders[0];

  const warningDecoration = decorationProvider.provideFileDecoration(vscode.Uri.parse(
    `gitguardex-agent://${sessionSchema.sanitizeBranchForFile('agent/codex/idle-warning')}`,
  ));
  assert.equal(warningDecoration.badge, '10m+');
  assert.equal(warningDecoration.tooltip, 'idle 10m+');
  assert.equal(warningDecoration.color.id, 'list.warningForeground');

  const errorDecoration = decorationProvider.provideFileDecoration(vscode.Uri.parse(
    `gitguardex-agent://${sessionSchema.sanitizeBranchForFile('agent/codex/idle-error')}`,
  ));
  assert.equal(errorDecoration.badge, '30m+');
  assert.equal(errorDecoration.tooltip, 'idle 30m+');
  assert.equal(errorDecoration.color.id, 'list.errorForeground');

  const workingDecoration = decorationProvider.provideFileDecoration(vscode.Uri.parse(
    `gitguardex-agent://${sessionSchema.sanitizeBranchForFile('agent/codex/working-now')}`,
  ));
  assert.equal(workingDecoration, undefined);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents refresh also invalidates session decorations', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-decoration-refresh-'));
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-decoration-refresh-session-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, 'agent/codex/idle-refresh');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch: 'agent/codex/idle-refresh',
      taskName: 'idle-refresh',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
      startedAt: new Date(Date.now() - (11 * 60 * 1000)).toISOString(),
    }), null, 2)}\n`,
    'utf8',
  );

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);

  const provider = registrations.providers[0].provider;
  await provider.getChildren();
  await flushAsyncWork();

  let decorationRefreshCount = 0;
  registrations.decorationProviders[0].onDidChangeFileDecorations(() => {
    decorationRefreshCount += 1;
  });

  await provider.refresh();
  assert.ok(decorationRefreshCount >= 1);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension shows grouped repo changes beside active agents', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-working-view-'));
  initGitRepo(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'root-file.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'root-file.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(tempRoot, 'root-file.txt'), 'base\nchanged\n', 'utf8');

  const worktreePath = path.join(tempRoot, 'sandbox');
  initGitRepo(worktreePath);
  fs.mkdirSync(path.join(worktreePath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  fs.writeFileSync(path.join(worktreePath, 'src', 'nested.js'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['add', 'src/nested.js']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');
  fs.writeFileSync(path.join(worktreePath, 'src', 'nested.js'), 'base\nchanged\n', 'utf8');

  const sessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/live-task',
    taskName: 'live-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
  }));

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const mockSessionSchema = {
    ...sessionSchema,
    readActiveSessions: () => sessionSchema.readActiveSessions(tempRoot, { includeStale: true }),
    readRepoChanges: () => [
      {
        relativePath: 'sandbox/src/nested.js',
        absolutePath: path.join(worktreePath, 'src', 'nested.js'),
        statusLabel: 'M',
        statusText: 'Modified',
      },
      {
        relativePath: 'sandbox/tracked.txt',
        absolutePath: path.join(worktreePath, 'tracked.txt'),
        statusLabel: 'M',
        statusText: 'Modified',
      },
      {
        relativePath: 'root-file.txt',
        absolutePath: path.join(tempRoot, 'root-file.txt'),
        statusLabel: 'M',
        statusText: 'Modified',
      },
    ],
  };
  const extension = loadExtensionWithMockVscode(vscode, mockSessionSchema);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  assert.equal(repoItem.description, '1 active · 1 working · 3 changed');
  const [agentsSection, changesSection] = await provider.getChildren(repoItem);
  assert.equal(agentsSection.label, 'ACTIVE AGENTS');
  assert.equal(changesSection.label, 'CHANGES');

  const [workingSection] = await provider.getChildren(agentsSection);
  assert.equal(workingSection.label, 'WORKING NOW');

  const [sessionItem] = await provider.getChildren(workingSection);
  assert.equal(sessionItem.label, `${path.basename(worktreePath)} 🔒 0`);
  assert.match(sessionItem.description, /^working · 2 files · /);
  assert.match(sessionItem.tooltip, /Changed 2 files: src\/nested\.js, tracked\.txt/);
  assert.equal(sessionItem.iconPath.id, 'edit');
  assert.deepEqual(registrations.treeViews[0].badge, {
    value: 1,
    tooltip: '1 active agent · 1 working now',
  });

  const [sessionGroup, repoRootGroup] = await provider.getChildren(changesSection);
  assert.equal(sessionGroup.label, `${path.basename(worktreePath)} 🔒 0`);
  assert.match(sessionGroup.description, /^working · 2 files · /);
  assert.equal(repoRootGroup.label, 'Repo root');

  const [folderItem, trackedItem] = await provider.getChildren(sessionGroup);
  assert.equal(folderItem.label, 'src');
  assert.equal(trackedItem.label, 'tracked.txt');
  assert.match(trackedItem.tooltip, /^tracked\.txt\nStatus Modified\n/);

  const [nestedItem] = await provider.getChildren(folderItem);
  assert.equal(nestedItem.label, 'nested.js');
  assert.match(nestedItem.tooltip, /^src\/nested\.js\nStatus Modified\n/);

  const [rootItem] = await provider.getChildren(repoRootGroup);
  assert.equal(rootItem.label, 'root-file.txt');
  assert.equal(rootItem.description, 'M');
  assert.match(rootItem.tooltip, /^root-file\.txt\nStatus Modified\n/);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension decorates sessions and repo changes from the lock registry', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-decorations-'));
  initGitRepo(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'root-file.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'root-file.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(tempRoot, 'root-file.txt'), 'base\nchanged\n', 'utf8');

  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-worktree-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const branch = 'agent/codex/live-task';
  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch,
      taskName: 'live-task',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const lockPath = path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    locks: {
      'owned-file.txt': {
        branch,
        claimed_at: '2026-04-22T08:55:00.000Z',
        allow_delete: false,
      },
      'root-file.txt': {
        branch: 'agent/codex/other-task',
        claimed_at: '2026-04-22T08:56:00.000Z',
        allow_delete: false,
      },
    },
  }, null, 2)}\n`, 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  const [agentsSection, changesSection] = await provider.getChildren(repoItem);
  const [idleSection] = await provider.getChildren(agentsSection);
  const [sessionItem] = await provider.getChildren(idleSection);
  assert.equal(sessionItem.label, `${path.basename(worktreePath)} 🔒 1`);
  assert.match(sessionItem.tooltip, /Locks 1/);

  const [repoRootGroup] = await provider.getChildren(changesSection);
  const [changeItem] = await provider.getChildren(repoRootGroup);
  assert.equal(changeItem.label, 'root-file.txt');
  assert.equal(changeItem.iconPath.id, 'warning');
  assert.match(changeItem.tooltip, /Locked by agent\/codex\/other-task/);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension re-reads lock state on watcher events instead of every tree load', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-watch-'));
  const branch = 'agent/codex/live-task';
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-watch-worktree-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch,
      taskName: 'live-task',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const lockPath = path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    locks: {
      'owned-file.txt': {
        branch,
        claimed_at: '2026-04-22T08:57:00.000Z',
        allow_delete: false,
      },
    },
  }, null, 2)}\n`, 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  const originalReadFileSync = fs.readFileSync;
  let lockReadCount = 0;
  fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
    if (path.resolve(String(filePath)) === lockPath) {
      lockReadCount += 1;
    }
    return originalReadFileSync.call(this, filePath, ...args);
  };

  try {
    extension.activate(context);
    await flushAsyncWork();

    const provider = registrations.providers[0].provider;
    const lockWatcher = registrations.watchers.find((watcher) => watcher.pattern === '**/.omx/state/agent-file-locks.json');
    assert.ok(lockWatcher, 'expected lock watcher registration');

    const [repoItem] = await provider.getChildren();
    const [agentsSection] = await provider.getChildren(repoItem);
    const [idleSection] = await provider.getChildren(agentsSection);
    const [sessionItem] = await provider.getChildren(idleSection);
    assert.equal(sessionItem.label, `${path.basename(worktreePath)} 🔒 1`);
    assert.equal(lockReadCount, 1);

    await provider.getChildren();
    assert.equal(lockReadCount, 1);

    fs.writeFileSync(lockPath, `${JSON.stringify({
      locks: {
        'owned-file.txt': {
          branch,
          claimed_at: '2026-04-22T08:57:00.000Z',
          allow_delete: false,
        },
        'second-owned-file.txt': {
          branch,
          claimed_at: '2026-04-22T08:58:00.000Z',
          allow_delete: false,
        },
      },
    }, null, 2)}\n`, 'utf8');
    lockWatcher.fireChange({ fsPath: lockPath });
    assert.equal(lockReadCount, 2);

    const [updatedRepoItem] = await provider.getChildren();
    const [updatedAgentsSection] = await provider.getChildren(updatedRepoItem);
    const [updatedIdleSection] = await provider.getChildren(updatedAgentsSection);
    const [updatedSessionItem] = await provider.getChildren(updatedIdleSection);
    assert.equal(updatedSessionItem.label, `${path.basename(worktreePath)} 🔒 2`);

    await provider.getChildren();
    assert.equal(lockReadCount, 2);
  } finally {
    fs.readFileSync = originalReadFileSync;
    for (const subscription of context.subscriptions) {
      subscription.dispose?.();
    }
  }
});

test('active-agents extension groups blocked, working, idle, stalled, and dead sessions in order', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-state-groups-'));
  const now = Date.now();

  const blockedPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-blocked-'));
  initGitRepo(blockedPath);
  fs.writeFileSync(path.join(blockedPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(blockedPath, ['add', 'tracked.txt']);
  runGit(blockedPath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(blockedPath, '.git', 'MERGE_HEAD'), 'deadbeef\n', 'utf8');

  const workingPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-working-'));
  initGitRepo(workingPath);
  fs.writeFileSync(path.join(workingPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(workingPath, ['add', 'tracked.txt']);
  runGit(workingPath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(workingPath, 'tracked.txt'), 'base\nchanged\n', 'utf8');

  const idlePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-idle-'));
  initGitRepo(idlePath);
  fs.writeFileSync(path.join(idlePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(idlePath, ['add', 'tracked.txt']);
  runGit(idlePath, ['commit', '-m', 'baseline']);
  setPathMtime(path.join(idlePath, 'tracked.txt'), now - 30_000);

  const stalledPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-stalled-'));
  initGitRepo(stalledPath);
  fs.writeFileSync(path.join(stalledPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(stalledPath, ['add', 'tracked.txt']);
  runGit(stalledPath, ['commit', '-m', 'baseline']);
  setPathMtime(path.join(stalledPath, 'tracked.txt'), now - (20 * 60 * 1000));

  const deadPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-dead-'));
  initGitRepo(deadPath);
  fs.writeFileSync(path.join(deadPath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(deadPath, ['add', 'tracked.txt']);
  runGit(deadPath, ['commit', '-m', 'baseline']);

  const blockedSessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/blocked-task',
    taskName: 'blocked-task',
    agentName: 'codex',
    worktreePath: blockedPath,
    pid: process.pid,
    cliName: 'codex',
  }));
  const workingSessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/working-task',
    taskName: 'working-task',
    agentName: 'codex',
    worktreePath: workingPath,
    pid: process.pid,
    cliName: 'codex',
  }));
  const idleSessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/idle-task',
    taskName: 'idle-task',
    agentName: 'codex',
    worktreePath: idlePath,
    pid: process.pid,
    cliName: 'codex',
  }));
  const stalledSessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/stalled-task',
    taskName: 'stalled-task',
    agentName: 'codex',
    worktreePath: stalledPath,
    pid: process.pid,
    cliName: 'codex',
  }));
  const deadSessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/dead-task',
    taskName: 'dead-task',
    agentName: 'codex',
    worktreePath: deadPath,
    pid: 999999,
    cliName: 'codex',
  }));

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [
    { fsPath: blockedSessionPath },
    { fsPath: workingSessionPath },
    { fsPath: idleSessionPath },
    { fsPath: stalledSessionPath },
    { fsPath: deadSessionPath },
  ];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  assert.equal(repoItem.description, '4 active · 1 dead · 1 working');

  const [agentsSection] = await provider.getChildren(repoItem);
  const [blockedSection, workingSection, idleSection, stalledSection, deadSection] = await provider.getChildren(agentsSection);
  assert.equal(blockedSection.label, 'BLOCKED');
  assert.equal(workingSection.label, 'WORKING NOW');
  assert.equal(idleSection.label, 'IDLE');
  assert.equal(stalledSection.label, 'STALLED');
  assert.equal(deadSection.label, 'DEAD');

  const [blockedItem] = await provider.getChildren(blockedSection);
  const [workingItem] = await provider.getChildren(workingSection);
  const [idleItem] = await provider.getChildren(idleSection);
  const [stalledItem] = await provider.getChildren(stalledSection);
  const [deadItem] = await provider.getChildren(deadSection);
  assert.match(blockedItem.description, /^blocked · \d+[smhd]/);
  assert.equal(blockedItem.iconPath.id, 'warning');
  assert.match(workingItem.description, /^working · 1 file · /);
  assert.equal(workingItem.iconPath.id, 'edit');
  assert.match(idleItem.description, /^idle · \d+[smhd]/);
  assert.equal(idleItem.iconPath.id, 'loading~spin');
  assert.match(stalledItem.description, /^stalled · \d+[smhd]/);
  assert.equal(stalledItem.iconPath.id, 'clock');
  assert.match(deadItem.description, /^dead · \d+[smhd]/);
  assert.equal(deadItem.iconPath.id, 'error');
  assert.deepEqual(registrations.treeViews[0].badge, {
    value: 5,
    tooltip: '4 active agents · 1 dead · 1 working now',
  });

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension watches active sessions, lock files, and session git indexes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-watchers-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  initGitRepo(worktreePath);

  const sessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/watch-task',
    taskName: 'watch-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
  }));

  const { registrations, vscode } = createMockVscode(tempRoot);
  let currentSessionFiles = [{ fsPath: sessionPath }];
  vscode.workspace.findFiles = async () => currentSessionFiles;
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  assert.deepEqual(
    registrations.fileWatchers.map((watcher) => watcher.pattern),
    [
      '**/.omx/state/active-sessions/*.json',
      '**/.omx/state/agent-file-locks.json',
      path.join(worktreePath, '.git', 'index'),
    ],
  );

  currentSessionFiles = [];
  fs.unlinkSync(sessionPath);
  registrations.fileWatchers[0].fireDelete({ fsPath: sessionPath });
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flushAsyncWork();

  assert.equal(registrations.fileWatchers[2].disposed, true);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension debounces refresh events with a trailing 250ms timer', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-debounce-'));
  const { registrations, vscode } = createMockVscode(tempRoot);
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  provider.onDidChangeTreeDataEmitter.fireCount = 0;

  registrations.fileWatchers[0].fireChange({ fsPath: path.join(tempRoot, '.omx', 'state', 'active-sessions', 'a.json') });
  registrations.fileWatchers[1].fireChange({ fsPath: path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json') });
  assert.equal(provider.onDidChangeTreeDataEmitter.fireCount, 0);

  await new Promise((resolve) => setTimeout(resolve, 300));
  await flushAsyncWork();

  assert.equal(provider.onDidChangeTreeDataEmitter.fireCount, 1);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension commits the selected session worktree from the SCM input', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-commit-view-'));
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-commit-session-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');
  fs.mkdirSync(path.join(worktreePath, '.omx', 'state'), { recursive: true });
  fs.writeFileSync(
    path.join(worktreePath, '.omx', 'state', 'agent-file-locks.json'),
    '{"owner":"codex"}\n',
    'utf8',
  );

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, 'agent/codex/commit-task');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch: 'agent/codex/commit-task',
      taskName: 'commit-task',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  const [agentsSection] = await provider.getChildren(repoItem);
  const [workingSection] = await provider.getChildren(agentsSection);
  const [sessionItem] = await provider.getChildren(workingSection);
  registrations.treeViews[0].fireSelection([sessionItem]);

  assert.equal(
    registrations.sourceControls[0].inputBox.placeholder,
    `Commit ${sessionItem.session.label} (Ctrl+Enter)`,
  );
  registrations.sourceControls[0].inputBox.value = 'Ship the selected sandbox';

  await vscode.commands.executeCommand('gitguardex.activeAgents.commitSelectedSession');

  const commitMessage = runGit(worktreePath, ['log', '-1', '--pretty=%s']).stdout.trim();
  assert.equal(commitMessage, 'Ship the selected sandbox');
  assert.equal(runGit(worktreePath, ['status', '--short', '--', 'tracked.txt']).stdout.trim(), '');
  assert.equal(
    runGit(worktreePath, ['status', '--short', '--', '.omx/state/agent-file-locks.json']).stdout.trim(),
    '?? .omx/state/agent-file-locks.json',
  );
  assert.equal(registrations.sourceControls[0].inputBox.value, '');
  assert.deepEqual(registrations.informationMessages, []);
  assert.deepEqual(registrations.errorMessages, []);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension asks for a session before committing', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-no-selection-'));
  const { registrations, vscode } = createMockVscode(tempRoot);
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  registrations.sourceControls[0].inputBox.value = 'Commit without a selection';

  await vscode.commands.executeCommand('gitguardex.activeAgents.commitSelectedSession');

  assert.deepEqual(registrations.informationMessages, ['Pick an Active Agents session first.']);
  assert.deepEqual(registrations.errorMessages, []);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension decorates sessions and repo changes from the lock registry', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-decorations-'));
  initGitRepo(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'root-file.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'root-file.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(tempRoot, 'root-file.txt'), 'base\nchanged\n', 'utf8');

  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-worktree-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const branch = 'agent/codex/live-task';
  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch,
      taskName: 'live-task',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const lockPath = path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    locks: {
      'owned-file.txt': {
        branch,
        claimed_at: '2026-04-22T08:55:00.000Z',
        allow_delete: false,
      },
      'root-file.txt': {
        branch: 'agent/codex/other-task',
        claimed_at: '2026-04-22T08:56:00.000Z',
        allow_delete: false,
      },
    },
  }, null, 2)}\n`, 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  const [agentsSection, changesSection] = await provider.getChildren(repoItem);
  const [idleSection] = await provider.getChildren(agentsSection);
  const [sessionItem] = await provider.getChildren(idleSection);
  assert.equal(sessionItem.label, `${path.basename(worktreePath)} 🔒 1`);
  assert.match(sessionItem.tooltip, /Locks 1/);

  const [repoRootGroup] = await provider.getChildren(changesSection);
  const [changeItem] = await provider.getChildren(repoRootGroup);
  assert.equal(changeItem.label, 'root-file.txt');
  assert.equal(changeItem.iconPath.id, 'warning');
  assert.match(changeItem.tooltip, /Locked by agent\/codex\/other-task/);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension re-reads lock state on watcher events instead of every tree load', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-watch-'));
  const branch = 'agent/codex/live-task';
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-lock-watch-worktree-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch,
      taskName: 'live-task',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const lockPath = path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    locks: {
      'owned-file.txt': {
        branch,
        claimed_at: '2026-04-22T08:57:00.000Z',
        allow_delete: false,
      },
    },
  }, null, 2)}\n`, 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  const originalReadFileSync = fs.readFileSync;
  let lockReadCount = 0;
  fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
    if (path.resolve(String(filePath)) === lockPath) {
      lockReadCount += 1;
    }
    return originalReadFileSync.call(this, filePath, ...args);
  };

  try {
    extension.activate(context);

    const provider = registrations.providers[0].provider;
    const lockWatcher = registrations.watchers.find((watcher) => watcher.pattern === '**/.omx/state/agent-file-locks.json');
    assert.ok(lockWatcher, 'expected lock watcher registration');

    const [repoItem] = await provider.getChildren();
    const [agentsSection] = await provider.getChildren(repoItem);
    const [thinkingSection] = await provider.getChildren(agentsSection);
    const [sessionItem] = await provider.getChildren(thinkingSection);
    assert.equal(sessionItem.label, `${path.basename(worktreePath)} 🔒 1`);
    assert.equal(lockReadCount, 1);

    await provider.getChildren();
    assert.equal(lockReadCount, 1);

    fs.writeFileSync(lockPath, `${JSON.stringify({
      locks: {
        'owned-file.txt': {
          branch,
          claimed_at: '2026-04-22T08:57:00.000Z',
          allow_delete: false,
        },
        'second-owned-file.txt': {
          branch,
          claimed_at: '2026-04-22T08:58:00.000Z',
          allow_delete: false,
        },
      },
    }, null, 2)}\n`, 'utf8');
    lockWatcher.fireChange({ fsPath: lockPath });
    assert.equal(lockReadCount, 2);

    const [updatedRepoItem] = await provider.getChildren();
    const [updatedAgentsSection] = await provider.getChildren(updatedRepoItem);
    const [updatedThinkingSection] = await provider.getChildren(updatedAgentsSection);
    const [updatedSessionItem] = await provider.getChildren(updatedThinkingSection);
    assert.equal(updatedSessionItem.label, `${path.basename(worktreePath)} 🔒 2`);

    await provider.getChildren();
    assert.equal(lockReadCount, 2);
  } finally {
    fs.readFileSync = originalReadFileSync;
    for (const subscription of context.subscriptions) {
      subscription.dispose?.();
    }
  }
});

test('active-agents extension launches finish and sync commands in session terminals', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-inline-actions-'));
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-inline-worktree-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, 'agent/codex/live-task');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch: 'agent/codex/live-task',
      taskName: 'live-task',
      agentName: 'codex',
      worktreePath,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [{ fsPath: sessionPath }];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  const [agentsSection] = await provider.getChildren(repoItem);
  const [idleSection] = await provider.getChildren(agentsSection);
  const [sessionItem] = await provider.getChildren(idleSection);

  await registrations.commands.get('gitguardex.activeAgents.finishSession')(sessionItem.session);
  await registrations.commands.get('gitguardex.activeAgents.syncSession')(sessionItem.session);

  assert.equal(registrations.terminals.length, 2);
  assert.equal(registrations.terminals[0].options.cwd, worktreePath);
  assert.equal(registrations.terminals[0].options.iconPath.id, 'check');
  assert.match(registrations.terminals[0].options.name, /GitGuardex Finish: live-task/);
  assert.deepEqual(registrations.terminals[0].sentTexts, [
    { text: "gx branch finish --branch 'agent/codex/live-task'", addNewLine: true },
  ]);
  assert.equal(registrations.terminals[0].shown, true);

  assert.equal(registrations.terminals[1].options.cwd, worktreePath);
  assert.equal(registrations.terminals[1].options.iconPath.id, 'sync');
  assert.match(registrations.terminals[1].options.name, /GitGuardex Sync: live-task/);
  assert.deepEqual(registrations.terminals[1].sentTexts, [
    { text: 'gx sync', addNewLine: true },
  ]);
  assert.equal(registrations.terminals[1].shown, true);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension confirms stop and sends SIGTERM to the session pid', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-stop-session-'));
  const { registrations, vscode } = createMockVscode(tempRoot);
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };
  let killed = null;
  const originalKill = process.kill;

  vscode.window.showWarningMessage = async (...args) => {
    registrations.warningMessages.push(args);
    return 'Stop';
  };
  process.kill = (pid, signal) => {
    killed = { pid, signal };
  };

  try {
    extension.activate(context);
    const provider = registrations.providers[0].provider;
    await flushAsyncWork();
    provider.onDidChangeTreeDataEmitter.fireCount = 0;

    await registrations.commands.get('gitguardex.activeAgents.stopSession')({
      label: 'live-task',
      pid: 4242,
    });
    await flushAsyncWork();
  } finally {
    process.kill = originalKill;
  }

  assert.deepEqual(killed, { pid: 4242, signal: 'SIGTERM' });
  assert.ok(registrations.providers[0].provider.onDidChangeTreeDataEmitter.fireCount >= 1);
  assert.equal(registrations.warningMessages.length, 1);
  assert.match(registrations.warningMessages[0][0], /Stop live-task\?/);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension opens git diff output in an untitled editor', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-open-diff-'));
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-open-diff-worktree-'));
  initGitRepo(worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);

  await registrations.commands.get('gitguardex.activeAgents.openSessionDiff')({
    label: 'live-task',
    worktreePath,
  });

  assert.equal(registrations.openedDocuments.length, 1);
  assert.equal(registrations.openedDocuments[0].language, 'diff');
  assert.match(registrations.openedDocuments[0].content, /^diff --git /);
  assert.equal(registrations.shownDocuments.length, 1);
  assert.equal(registrations.shownDocuments[0].document.uri.scheme, 'untitled');

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});
