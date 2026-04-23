const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(repoRoot, 'bin', 'multiagent-safety.js');
const sessionScript = path.join(repoRoot, 'scripts', 'agent-session-state.js');
const installScript = path.join(repoRoot, 'scripts', 'install-vscode-active-agents-extension.js');
const extensionManifestPath = path.join(
  repoRoot,
  'vscode',
  'guardex-active-agents',
  'package.json',
);
const templateExtensionManifestPath = path.join(
  repoRoot,
  'templates',
  'vscode',
  'guardex-active-agents',
  'package.json',
);
const sessionSchema = require(path.join(
  repoRoot,
  'vscode',
  'guardex-active-agents',
  'session-schema.js',
));
const extensionEntry = path.join(repoRoot, 'vscode', 'guardex-active-agents', 'extension.js');

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseSimpleSemver(version) {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  assert.equal(parts.length, 3, `Expected simple semver, received ${version}`);
  for (const part of parts) {
    assert.equal(Number.isNaN(part), false, `Expected numeric semver, received ${version}`);
  }
  return parts;
}

function compareSimpleSemver(left, right) {
  const leftParts = parseSimpleSemver(left);
  const rightParts = parseSimpleSemver(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function resolveRepoBaseRef() {
  for (const candidate of ['origin/main', 'main']) {
    const result = cp.spawnSync('git', ['-C', repoRoot, 'rev-parse', '--verify', candidate], {
      encoding: 'utf8',
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  throw new Error('Could not resolve a base ref for the extension version guard.');
}

function readExtensionManifest(filePath = extensionManifestPath) {
  return readJson(filePath);
}

function readBaseExtensionManifest(baseRef) {
  const result = cp.spawnSync(
    'git',
    ['-C', repoRoot, 'show', `${baseRef}:vscode/guardex-active-agents/package.json`],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function readChangedExtensionPaths(baseRef) {
  const result = cp.spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'diff',
      '--name-only',
      `${baseRef}...HEAD`,
      '--',
      'vscode/guardex-active-agents',
      'templates/vscode/guardex-active-agents',
      'scripts/install-vscode-active-agents-extension.js',
    ],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function buildWorktreeLockPayload(worktreePath, overrides = {}) {
  return {
    schemaVersion: 1,
    source: 'recodee-live-telemetry',
    updatedAt: '2026-04-22T08:56:00.000Z',
    worktreePath,
    worktreeName: path.basename(worktreePath),
    collaboration: false,
    snapshotCount: 1,
    sessionCount: 1,
    snapshots: [
      {
        snapshotName: 'snapshot-a',
        accountId: 'acct-1',
        email: 'agent@example.com',
        liveSessionCount: 1,
        trackedSessionCount: 1,
        compatSessionCount: 1,
        sessions: [
          {
            sessionKey: 'pid:101',
            taskPreview: 'Implement live worktree telemetry',
            taskUpdatedAt: '2026-04-22T08:55:00.000Z',
            projectName: 'gitguardex',
            projectPath: worktreePath,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function writeWorktreeLock(worktreePath, overrides = {}) {
  const lockPath = path.join(worktreePath, 'AGENT.lock');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify(buildWorktreeLockPayload(worktreePath, overrides), null, 2)}\n`,
    'utf8',
  );
  return lockPath;
}

async function getOnlyChild(provider, item) {
  const children = await provider.getChildren(item);
  assert.equal(children.length, 1, `Expected exactly one child for ${item?.label || 'item'}`);
  return children[0];
}

async function getOnlyWorktreeAndSession(provider, sectionItem) {
  const worktreeItem = await getOnlyChild(provider, sectionItem);
  const sessionItem = await getOnlyChild(provider, worktreeItem);
  return { worktreeItem, sessionItem };
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
    statusBarItems: [],
    commands: new Map(),
    executedCommands: [],
    sourceControls: [],
    terminals: [],
    openedDocuments: [],
    shownDocuments: [],
    infoMessages: [],
    infoResponses: [],
    inputResponses: [],
    quickPickCalls: [],
    quickPickResponse: undefined,
    informationMessages: [],
    errorMessages: [],
    warningMessages: [],
    webviewPanels: [],
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
      StatusBarAlignment: {
        Left: 1,
        Right: 2,
      },
      ViewColumn: {
        Beside: 2,
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
          return registrations.infoResponses.shift();
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
        createWebviewPanel: (viewType, title, column, options) => {
          const disposeListeners = [];
          const panel = {
            viewType,
            title,
            column,
            options,
            disposed: false,
            revealCalls: [],
            webview: {
              html: '',
            },
            onDidDispose(listener) {
              disposeListeners.push(listener);
              return disposable(() => {
                const index = disposeListeners.indexOf(listener);
                if (index >= 0) {
                  disposeListeners.splice(index, 1);
                }
              });
            },
            reveal(nextColumn) {
              panel.revealCalls.push(nextColumn);
            },
            dispose() {
              if (panel.disposed) {
                return;
              }
              panel.disposed = true;
              for (const listener of [...disposeListeners]) {
                listener();
              }
            },
          };
          registrations.webviewPanels.push(panel);
          return panel;
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
        createStatusBarItem: (alignment, priority) => {
          const statusBarItem = {
            alignment,
            priority,
            text: '',
            tooltip: '',
            command: undefined,
            name: undefined,
            visible: false,
            show() {
              this.visible = true;
            },
            hide() {
              this.visible = false;
            },
            dispose() {},
          };
          registrations.statusBarItems.push(statusBarItem);
          return statusBarItem;
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
  assert.equal(parsed.state, 'working');
  assert.equal(typeof parsed.lastHeartbeatAt, 'string');
  assert.ok(Date.parse(parsed.lastHeartbeatAt) >= Date.parse(parsed.startedAt));

  const sessions = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].label, 'agent__codex__demo-task');
  assert.equal(sessions[0].taskMode, 'caveman');
  assert.equal(sessions[0].openspecTier, 'T1');

  const heartbeat = runNode(sessionScript, [
    'heartbeat',
    '--repo',
    tempRoot,
    '--branch',
    branch,
    '--state',
    'thinking',
  ]);
  assert.equal(heartbeat.status, 0, heartbeat.stderr);
  const heartbeatParsed = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  assert.equal(heartbeatParsed.branch, branch);
  assert.equal(heartbeatParsed.state, 'thinking');
  assert.ok(Date.parse(heartbeatParsed.lastHeartbeatAt) >= Date.parse(parsed.lastHeartbeatAt));

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

test('gx internal heartbeat refreshes active session records through the CLI', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-cli-heartbeat-'));
  initGitRepo(tempRoot);
  const branch = 'agent/codex/cli-heartbeat-task';
  const worktreePath = path.join(tempRoot, '.omx', 'agent-worktrees', 'agent__codex__cli-heartbeat-task');
  fs.mkdirSync(worktreePath, { recursive: true });
  const sessionPath = writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch,
    taskName: 'cli-heartbeat-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
    state: 'working',
  }));
  const before = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  const heartbeat = runNode(cliEntry, [
    'internal',
    'heartbeat',
    '--target',
    tempRoot,
    '--branch',
    branch,
    '--state',
    'idle',
  ], { cwd: repoRoot });
  assert.equal(heartbeat.status, 0, heartbeat.stderr);

  const after = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  assert.equal(after.branch, branch);
  assert.equal(after.taskName, before.taskName);
  assert.equal(after.state, 'idle');
  assert.ok(Date.parse(after.lastHeartbeatAt) >= Date.parse(before.lastHeartbeatAt));
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

test('session-schema falls back to managed worktree AGENT.lock telemetry when launcher state is absent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-lock-fallback-'));
  const worktreePath = path.join(
    tempRoot,
    '.omx',
    'agent-worktrees',
    'agent__codex__live-lock-task',
  );
  initGitRepo(worktreePath);
  runGit(worktreePath, ['checkout', '-b', 'agent/codex/live-lock-task']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');
  writeWorktreeLock(worktreePath);

  const [session] = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(session.sourceKind, 'worktree-lock');
  assert.equal(session.branch, 'agent/codex/live-lock-task');
  assert.equal(session.agentName, 'codex');
  assert.equal(session.taskName, 'Implement live worktree telemetry');
  assert.equal(session.activityKind, 'working');
  assert.equal(session.activityCountLabel, '1 file');
  assert.equal(session.telemetrySource, 'recodee-live-telemetry');
  assert.equal(session.telemetryUpdatedAt, '2026-04-22T08:56:00.000Z');
});

test('session-schema falls back to plain managed worktrees when launcher state and AGENT.lock are absent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-managed-fallback-'));
  const worktreePath = path.join(
    tempRoot,
    '.omx',
    'agent-worktrees',
    'agent__codex__plain-visible-task',
  );
  initGitRepo(worktreePath);
  runGit(worktreePath, ['checkout', '-b', 'agent/codex/plain-visible-task']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');

  const [session] = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(session.sourceKind, 'managed-worktree');
  assert.equal(session.branch, 'agent/codex/plain-visible-task');
  assert.equal(session.agentName, 'codex');
  assert.equal(session.taskName, 'agent__codex__plain-visible-task');
  assert.equal(session.activityKind, 'working');
  assert.equal(session.activityCountLabel, '1 file');
  assert.equal(session.telemetrySource, 'managed-worktree');
});

test('session-schema prefers live worktree telemetry over a dead launcher record for the same worktree', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-lock-prefer-'));
  const worktreePath = path.join(
    tempRoot,
    '.omx',
    'agent-worktrees',
    'agent__codex__replace-dead-session',
  );
  initGitRepo(worktreePath);
  runGit(worktreePath, ['checkout', '-b', 'agent/codex/replace-dead-session']);
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'tracked.txt']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  writeWorktreeLock(worktreePath, {
    updatedAt: '2026-04-22T08:57:00.000Z',
  });
  writeSessionRecord(tempRoot, sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/replace-dead-session',
    taskName: 'replace-dead-session',
    agentName: 'codex',
    worktreePath,
    pid: 999999,
    cliName: 'codex',
  }));

  const [session] = sessionSchema.readActiveSessions(tempRoot, { includeStale: true });
  assert.equal(session.sourceKind, 'worktree-lock');
  assert.equal(session.activityKind, 'idle');
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
  assert.deepEqual(session.worktreeChangedPaths, ['new-file.txt', 'tracked.txt']);
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
  const idleSession = sessionSchema.deriveSessionActivity(record, { now, useCache: false });
  assert.equal(idleSession.activityKind, 'idle');
  assert.match(idleSession.activitySummary, /Recent file activity 45s ago\./);
  assert.equal(idleSession.lastFileActivityAt, new Date(now - 45_000).toISOString());

  setPathMtime(trackedPath, now - (20 * 60 * 1000));
  const stalledSession = sessionSchema.deriveSessionActivity(record, { now, useCache: false });
  assert.equal(stalledSession.activityKind, 'stalled');
  assert.match(stalledSession.activitySummary, /No file activity for 20m 0s\./);
  assert.equal(stalledSession.lastFileActivityAt, new Date(now - (20 * 60 * 1000)).toISOString());
});

test('session-schema caps clean-worktree stat scans and caches activity lookups briefly', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-cache-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  initGitRepo(worktreePath);

  for (let index = 0; index < 205; index += 1) {
    const filePath = path.join(worktreePath, 'src', `tracked-${String(index).padStart(3, '0')}.txt`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `file ${index}\n`, 'utf8');
  }
  runGit(worktreePath, ['add', '.']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);

  const now = Date.parse('2026-04-22T10:00:00.000Z');
  for (let index = 0; index < 205; index += 1) {
    setPathMtime(
      path.join(worktreePath, 'src', `tracked-${String(index).padStart(3, '0')}.txt`),
      now - 90_000,
    );
  }
  const trackedPath = path.join(worktreePath, 'src', 'tracked-000.txt');
  setPathMtime(trackedPath, now - 30_000);

  const record = sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/cached-activity',
    taskName: 'cached-activity',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
  });

  let statCount = 0;
  const originalStatSync = fs.statSync;
  fs.statSync = (...args) => {
    const filePath = String(args[0] || '');
    if (filePath.startsWith(worktreePath) && filePath.endsWith('.txt')) {
      statCount += 1;
    }
    return originalStatSync(...args);
  };

  try {
    const firstSession = sessionSchema.deriveSessionActivity(record, { now });
    const firstStatCount = statCount;
    const secondSession = sessionSchema.deriveSessionActivity(record, { now: now + 1_000 });

    assert.equal(firstSession.activityKind, 'idle');
    assert.equal(firstSession.lastFileActivityAt, new Date(now - 30_000).toISOString());
    assert.ok(firstStatCount <= 200, `expected <=200 file stats, saw ${firstStatCount}`);
    assert.equal(secondSession.lastFileActivityAt, firstSession.lastFileActivityAt);
    assert.equal(statCount, firstStatCount);
  } finally {
    fs.statSync = originalStatSync;
    sessionSchema.clearWorktreeActivityCache(worktreePath);
  }
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

test('session-schema derives dead activity when launcher heartbeat is stale', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-stale-heartbeat-'));
  const worktreePath = path.join(tempRoot, 'sandbox');
  const lastHeartbeatAt = '2026-04-22T10:00:00.000Z';
  const session = sessionSchema.deriveSessionActivity(sessionSchema.buildSessionRecord({
    repoRoot: tempRoot,
    branch: 'agent/codex/stale-heartbeat-task',
    taskName: 'stale-heartbeat-task',
    agentName: 'codex',
    worktreePath,
    pid: process.pid,
    cliName: 'codex',
    startedAt: lastHeartbeatAt,
    lastHeartbeatAt,
  }), { now: Date.parse('2026-04-22T10:06:00.000Z') });

  assert.equal(session.activityKind, 'dead');
  assert.equal(session.activitySummary, 'Heartbeat stale for 6m 0s.');
});

test('session-schema derives repo change rows from root git status', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-root-status-'));
  initGitRepo(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'tracked.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);

  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\nchanged\n', 'utf8');
  fs.writeFileSync(path.join(tempRoot, 'new-file.txt'), 'new\n', 'utf8');
  fs.mkdirSync(path.join(tempRoot, '.omx', 'agent-worktrees', 'agent__codex__sandbox'), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, '.omx', 'agent-worktrees', 'agent__codex__sandbox', 'sandbox.txt'),
    'sandbox\n',
    'utf8',
  );
  fs.mkdirSync(path.join(tempRoot, '.omc', 'agent-worktrees', 'agent__claude__sandbox'), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, '.omc', 'agent-worktrees', 'agent__claude__sandbox', 'sandbox.txt'),
    'sandbox\n',
    'utf8',
  );
  fs.mkdirSync(path.join(tempRoot, '.omx', 'state', 'active-sessions'), { recursive: true });
  fs.writeFileSync(
    path.join(tempRoot, '.omx', 'state', 'active-sessions', 'agent__codex__sandbox.json'),
    '{}\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json'),
    '{"locks":{}}\n',
    'utf8',
  );

  const changes = sessionSchema.readRepoChanges(tempRoot);
  assert.deepEqual(
    changes.map((change) => [change.relativePath, change.statusLabel]),
    [
      ['new-file.txt', 'U'],
      ['tracked.txt', 'M'],
    ],
  );
});

test('session-schema reads inspect data from base-branch config, log tail, and held locks', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-inspect-'));
  const remoteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-active-session-inspect-remote-'));
  const branch = 'agent/codex/inspect-task';

  initGitRepo(tempRoot);
  runGit(tempRoot, ['checkout', '-b', 'main']);
  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'tracked.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);
  runGit(remoteRoot, ['init', '--bare']);
  runGit(tempRoot, ['remote', 'add', 'origin', remoteRoot]);
  runGit(tempRoot, ['push', '-u', 'origin', 'main']);
  runGit(tempRoot, ['config', 'multiagent.baseBranch', 'main']);
  runGit(tempRoot, ['checkout', '-b', branch]);
  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\ninspect\n', 'utf8');
  runGit(tempRoot, ['add', 'tracked.txt']);
  runGit(tempRoot, ['commit', '-m', 'inspect ahead commit']);

  const logPath = path.join(
    tempRoot,
    '.omx',
    'logs',
    `agent-${sessionSchema.sanitizeBranchForFile(branch)}.log`,
  );
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, 'log line 1\nlog line 2\n', 'utf8');

  const lockPath = path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    locks: {
      'src/alpha.js': {
        branch,
        claimed_at: '2026-04-22T09:10:00.000Z',
        allow_delete: false,
      },
      'src/beta.js': {
        branch,
        claimed_at: '2026-04-22T09:11:00.000Z',
        allow_delete: true,
      },
      'src/foreign.js': {
        branch: 'agent/codex/other-task',
        claimed_at: '2026-04-22T09:12:00.000Z',
        allow_delete: false,
      },
    },
  }, null, 2)}\n`, 'utf8');

  const inspectData = sessionSchema.readSessionInspectData({
    repoRoot: tempRoot,
    branch,
    worktreePath: tempRoot,
  });

  assert.equal(inspectData.baseBranch, 'main');
  assert.equal(inspectData.compareRef, 'origin/main');
  assert.equal(inspectData.aheadCount, 1);
  assert.equal(inspectData.behindCount, 0);
  assert.equal(inspectData.logPath, logPath);
  assert.equal(inspectData.logExists, true);
  assert.match(inspectData.logTailText, /log line 2/);
  assert.deepEqual(
    inspectData.heldLocks.map((entry) => entry.relativePath),
    ['src/alpha.js', 'src/beta.js'],
  );
});

test('install-vscode-active-agents-extension installs the current extension into a canonical dir and refreshes recent patch compatibility copies', () => {
  const tempExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-ext-'));
  const manifest = readExtensionManifest();
  const extensionId = `${manifest.publisher}.${manifest.name}`;
  const [major, minor, patch] = parseSimpleSemver(manifest.version);
  const canonicalDir = path.join(tempExtensionsDir, extensionId);
  const currentVersionDir = path.join(tempExtensionsDir, `${extensionId}-${manifest.version}`);
  const recentCompatDir = patch > 0
    ? path.join(tempExtensionsDir, `${extensionId}-${major}.${minor}.${patch - 1}`)
    : currentVersionDir;
  const farLegacyDir = path.join(tempExtensionsDir, `${extensionId}-99.99.99`);

  fs.mkdirSync(recentCompatDir, { recursive: true });
  fs.writeFileSync(path.join(recentCompatDir, 'stale.txt'), 'old', 'utf8');
  fs.mkdirSync(farLegacyDir, { recursive: true });
  fs.writeFileSync(path.join(farLegacyDir, 'stale.txt'), 'old', 'utf8');

  const result = runNode(installScript, ['--extensions-dir', tempExtensionsDir], {
    cwd: repoRoot,
  });
  assert.equal(result.status, 0, result.stderr);

  const installedManifest = readJson(path.join(canonicalDir, 'package.json'));
  assert.equal(fs.existsSync(canonicalDir), true);
  assert.equal(fs.existsSync(path.join(canonicalDir, 'extension.js')), true);
  assert.equal(fs.existsSync(path.join(canonicalDir, 'session-schema.js')), true);
  assert.equal(installedManifest.icon, 'icon.png');
  assert.equal(installedManifest.version, manifest.version);
  assert.deepEqual(installedManifest.activationEvents, manifest.activationEvents);
  assert.equal(installedManifest.activationEvents.includes('onStartupFinished'), true);
  assert.equal(fs.existsSync(path.join(canonicalDir, 'icon.png')), true);
  assert.equal(fs.existsSync(currentVersionDir), true);
  assert.equal(fs.existsSync(path.join(recentCompatDir, 'package.json')), true);
  assert.equal(fs.existsSync(path.join(recentCompatDir, 'stale.txt')), false);
  assert.equal(fs.existsSync(farLegacyDir), false);
  assert.match(result.stdout, new RegExp(`Installed ${extensionId}@${manifest.version} to ${canonicalDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, /Refreshed \d+ recent patch compatibility path\(s\)/);
  assert.match(result.stdout, /Reload each already-open VS Code window/);
});

test('active-agents extension edits require a higher manifest version than the base branch', () => {
  const baseRef = resolveRepoBaseRef();
  const changedPaths = readChangedExtensionPaths(baseRef);

  if (changedPaths.length === 0) {
    return;
  }

  const liveManifest = readExtensionManifest();
  const templateManifest = readExtensionManifest(templateExtensionManifestPath);
  const baseManifest = readBaseExtensionManifest(baseRef);

  assert.equal(
    liveManifest.version,
    templateManifest.version,
    'Live and template Active Agents manifests must stay in sync.',
  );
  assert.deepEqual(
    liveManifest.activationEvents,
    templateManifest.activationEvents,
    'Live and template Active Agents activation events must stay in sync.',
  );
  assert.equal(
    liveManifest.activationEvents.includes('onStartupFinished'),
    true,
    'Active Agents manifests must activate on VS Code startup.',
  );
  assert.ok(
    compareSimpleSemver(liveManifest.version, baseManifest.version) > 0,
    [
      `Active Agents extension files changed (${changedPaths.join(', ')})`,
      `but version ${liveManifest.version} did not increase above ${baseManifest.version}.`,
    ].join(' '),
  );
});

test('active-agents extension auto-installs a newer workspace build and offers reload', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-autoupdate-'));
  const repoManifest = {
    ...readExtensionManifest(),
    version: '9.9.9',
  };
  const repoManifestPath = path.join(tempRoot, 'vscode', 'guardex-active-agents', 'package.json');
  const repoInstallScriptPath = path.join(tempRoot, 'scripts', 'install-vscode-active-agents-extension.js');
  fs.mkdirSync(path.dirname(repoManifestPath), { recursive: true });
  fs.writeFileSync(repoManifestPath, `${JSON.stringify(repoManifest, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(repoInstallScriptPath), { recursive: true });
  fs.writeFileSync(repoInstallScriptPath, '#!/usr/bin/env node\n', 'utf8');

  const execCalls = [];
  const originalExecFile = cp.execFile;
  let context;
  cp.execFile = (file, args, options, callback) => {
    execCalls.push({ file, args, options });
    callback(null, '[guardex-active-agents] ok\n', '');
  };

  try {
    const { registrations, vscode } = createMockVscode(tempRoot);
    registrations.infoResponses.push('Reload Window');
    const extension = loadExtensionWithMockVscode(vscode);
    context = {
      subscriptions: [],
      extension: {
        packageJSON: {
          version: '0.0.2',
        },
      },
    };

    extension.activate(context);
    await flushAsyncWork();

    assert.equal(execCalls.length, 1);
    assert.equal(execCalls[0].file, process.execPath);
    assert.deepEqual(execCalls[0].args, [repoInstallScriptPath]);
    assert.equal(execCalls[0].options.cwd, tempRoot);
    assert.equal(execCalls[0].options.encoding, 'utf8');
    assert.match(
      registrations.informationMessages.at(-1),
      /GitGuardex Active Agents updated to 9\.9\.9.*reload any other already-open VS Code windows/i,
    );
    assert.deepEqual(registrations.infoMessages.at(-1).slice(1), ['Reload Window', 'Later']);
    assert.equal(
      registrations.executedCommands.some(
        (entry) => entry.command === 'workbench.action.reloadWindow',
      ),
      true,
    );
  } finally {
    cp.execFile = originalExecFile;
    for (const subscription of context?.subscriptions ?? []) {
      subscription.dispose?.();
    }
  }
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
  assert.equal(registrations.statusBarItems.length, 1);
  assert.equal(registrations.treeViews[0].viewId, 'gitguardex.activeAgents');
  assert.equal(registrations.sourceControls[0].label, 'Active Agents Commit');
  assert.equal(registrations.statusBarItems[0].name, 'GitGuardex Active Agents');
  assert.equal(registrations.statusBarItems[0].command, 'gitguardex.activeAgents.focus');
  assert.equal(registrations.statusBarItems[0].visible, false);
  assert.equal(
    registrations.sourceControls[0].inputBox.placeholder,
    'Pick an Active Agents session to commit its worktree.',
  );
  assert.equal(registrations.providers.length, 1);
  assert.equal(registrations.providers[0].viewId, 'gitguardex.activeAgents');
  assert.equal(registrations.decorationProviders.length, 1);
  assert.equal(registrations.fileWatchers.length, 4);
  assert.deepEqual(
    registrations.fileWatchers.map((watcher) => watcher.pattern),
    [
      '**/.omx/state/active-sessions/*.json',
      '**/.omx/state/agent-file-locks.json',
      '**/{.omx,.omc}/agent-worktrees/**/AGENT.lock',
      '**/.omx/logs/*.log',
    ],
  );
  assert.equal(registrations.workspaceFolderListeners.length, 1);

  const provider = registrations.providers[0].provider;
  assert.equal(typeof provider.getTreeItem, 'function');
  assert.equal(typeof registrations.commands.get('gitguardex.activeAgents.startAgent'), 'function');
  assert.equal(typeof registrations.commands.get('gitguardex.activeAgents.inspect'), 'function');

  const rootItems = await provider.getChildren();
  assert.equal(rootItems.length, 1);
  assert.equal(rootItems[0].label, 'No active Guardex agents');
  assert.equal(registrations.treeViews[0].badge, undefined);
  assert.equal(registrations.treeViews[0].message, undefined);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension startAgent command prefers the Guardex launcher in a terminal', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-start-agent-'));
  fs.mkdirSync(path.join(tempRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'scripts', 'codex-agent.sh'), '#!/usr/bin/env bash\n', 'utf8');
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
      text: "bash ./scripts/codex-agent.sh 'demo task' 'codex'",
      addNewLine: true,
    },
  ]);
  assert.deepEqual(registrations.quickPickCalls, []);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension startAgent command falls back to gx branch start without a Guardex launcher', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-start-agent-fallback-'));
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
  assert.equal(idleSection.label, 'THINKING');

  const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, idleSection);
  assert.equal(worktreeItem.label, 'live-task');
  assert.equal(sessionItem.label, 'agent/codex/live-task');
  assert.match(sessionItem.description, /^idle · \d+[smhd]/);
  assert.equal(sessionItem.iconPath.id, 'comment-discussion');
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
  assert.equal(
    registrations.executedCommands.some((entry) => (
      entry.command === 'setContext'
      && entry.args[0] === 'guardex.hasAgents'
      && entry.args[1] === true
    )),
    true,
  );

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

  const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, workingSection);
  assert.equal(worktreeItem.label, `${path.basename(worktreePath)}`);
  assert.equal(sessionItem.label, sessionItem.session.branch);
  assert.match(sessionItem.description, /^working · 2 files · /);
  assert.match(sessionItem.tooltip, /Changed 2 files: src\/nested\.js, tracked\.txt/);
  assert.equal(sessionItem.iconPath.id, 'loading~spin');
  const [activeFolderItem, activeTrackedItem] = await provider.getChildren(sessionItem);
  assert.equal(activeFolderItem.label, 'src');
  assert.equal(activeTrackedItem.label, 'tracked.txt');
  assert.match(activeTrackedItem.tooltip, /^tracked\.txt\nStatus Touched\n/);
  assert.deepEqual(registrations.treeViews[0].badge, {
    value: 1,
    tooltip: '1 active agent · 1 working now',
  });

  const [worktreeGroup, repoRootGroup] = await provider.getChildren(changesSection);
  assert.equal(worktreeGroup.label, `${path.basename(worktreePath)}`);
  assert.equal(worktreeGroup.description, '1 agent · 2 changed');
  assert.equal(repoRootGroup.label, 'Repo root');

  const [sessionGroup] = await provider.getChildren(worktreeGroup);
  assert.equal(sessionGroup.label, sessionItem.label);
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

test('active-agents extension surfaces live managed worktrees from AGENT.lock fallback', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-worktree-lock-view-'));
  initGitRepo(tempRoot);

  const worktreePath = path.join(
    tempRoot,
    '.omx',
    'agent-worktrees',
    'agent__codex__lock-visible-task',
  );
  initGitRepo(worktreePath);
  runGit(worktreePath, ['checkout', '-b', 'agent/codex/lock-visible-task']);
  fs.mkdirSync(path.join(worktreePath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worktreePath, 'src', 'live.js'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'src/live.js']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'src', 'live.js'), 'base\nchanged\n', 'utf8');
  const lockPath = writeWorktreeLock(worktreePath, {
    updatedAt: '2026-04-22T09:01:00.000Z',
  });

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async (pattern) => {
    if (pattern === '**/.omx/state/active-sessions/*.json') {
      return [];
    }
    if (pattern === '**/{.omx,.omc}/agent-worktrees/**/AGENT.lock') {
      return [{ fsPath: lockPath }];
    }
    return [];
  };
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  assert.equal(repoItem.description, '1 active · 1 working · 1 changed');

  const [agentsSection] = await provider.getChildren(repoItem);
  assert.deepEqual((await provider.getChildren(repoItem)).map((item) => item.label), ['ACTIVE AGENTS']);
  const [workingSection] = await provider.getChildren(agentsSection);
  const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, workingSection);
  assert.equal(workingSection.label, 'WORKING NOW');
  assert.equal(worktreeItem.label, `${path.basename(worktreePath)}`);
  assert.equal(sessionItem.label, 'agent/codex/lock-visible-task');
  assert.match(sessionItem.description, /^working · 1 file · /);
  assert.match(sessionItem.tooltip, /Telemetry updated 2026-04-22T09:01:00.000Z/);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension surfaces plain managed worktrees from workspace fallback', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-managed-worktree-view-'));
  initGitRepo(tempRoot);

  const worktreePath = path.join(
    tempRoot,
    '.omx',
    'agent-worktrees',
    'agent__codex__plain-visible-task',
  );
  initGitRepo(worktreePath);
  runGit(worktreePath, ['checkout', '-b', 'agent/codex/plain-visible-task']);
  fs.mkdirSync(path.join(worktreePath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worktreePath, 'src', 'live.js'), 'base\n', 'utf8');
  runGit(worktreePath, ['add', 'src/live.js']);
  runGit(worktreePath, ['commit', '-m', 'baseline']);
  fs.writeFileSync(path.join(worktreePath, 'src', 'live.js'), 'base\nchanged\n', 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async () => [];
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  assert.equal(repoItem.description, '1 active · 1 working · 1 changed');

  const [agentsSection] = await provider.getChildren(repoItem);
  const [workingSection] = await provider.getChildren(agentsSection);
  const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, workingSection);
  assert.equal(workingSection.label, 'WORKING NOW');
  assert.equal(worktreeItem.label, path.basename(worktreePath));
  assert.equal(sessionItem.label, 'agent/codex/plain-visible-task');
  assert.match(sessionItem.description, /^working · 1 file · /);
  assert.match(sessionItem.tooltip, /Started /);

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
  fs.writeFileSync(path.join(worktreePath, 'tracked.txt'), 'base\nchanged\n', 'utf8');

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
      'tracked.txt': {
        branch: 'agent/codex/other-task',
        claimed_at: '2026-04-22T08:57:00.000Z',
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
  assert.equal(repoItem.description, '1 active · 1 working · 2 changed');
  const [workingSection] = await provider.getChildren(agentsSection);
  const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, workingSection);
  assert.equal(worktreeItem.label, `${path.basename(worktreePath)}`);
  assert.equal(sessionItem.label, branch);
  assert.match(sessionItem.tooltip, /Locks 1/);
  assert.match(sessionItem.tooltip, /Conflicts 1/);

  const [sessionChangeItem] = await provider.getChildren(sessionItem);
  assert.equal(sessionChangeItem.label, 'tracked.txt');
  assert.equal(sessionChangeItem.iconPath.id, 'warning');
  assert.match(sessionChangeItem.tooltip, /Locked by agent\/codex\/other-task/);

  const [repoRootGroup] = await provider.getChildren(changesSection);
  const [changeItem] = await provider.getChildren(repoRootGroup);
  assert.equal(changeItem.label, 'root-file.txt');
  assert.equal(changeItem.iconPath.id, 'warning');
  assert.match(changeItem.tooltip, /Locked by agent\/codex\/other-task/);
  assert.deepEqual(registrations.treeViews[0].badge, {
    value: 1,
    tooltip: '1 active agent · 1 working now · 2 conflicts',
  });
  assert.equal(
    registrations.executedCommands.some((entry) => (
      entry.command === 'setContext'
      && entry.args[0] === 'guardex.hasConflicts'
      && entry.args[1] === true
    )),
    true,
  );

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
    const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, idleSection);
    assert.equal(worktreeItem.label, `${path.basename(worktreePath)}`);
    assert.equal(sessionItem.label, branch);
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
    const { worktreeItem: updatedWorktreeItem, sessionItem: updatedSessionItem } = await getOnlyWorktreeAndSession(provider, updatedIdleSection);
    assert.equal(updatedWorktreeItem.label, `${path.basename(worktreePath)}`);
    assert.equal(updatedSessionItem.label, branch);

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
  assert.equal(repoItem.description, '4 active · 1 dead · 1 working · 1 changed');

  const [agentsSection] = await provider.getChildren(repoItem);
  const [blockedSection, workingSection, idleSection, stalledSection, deadSection] = await provider.getChildren(agentsSection);
  assert.equal(blockedSection.label, 'BLOCKED');
  assert.equal(workingSection.label, 'WORKING NOW');
  assert.equal(idleSection.label, 'THINKING');
  assert.equal(stalledSection.label, 'STALLED');
  assert.equal(deadSection.label, 'DEAD');

  const { sessionItem: blockedItem } = await getOnlyWorktreeAndSession(provider, blockedSection);
  const { sessionItem: workingItem } = await getOnlyWorktreeAndSession(provider, workingSection);
  const { sessionItem: idleItem } = await getOnlyWorktreeAndSession(provider, idleSection);
  const { sessionItem: stalledItem } = await getOnlyWorktreeAndSession(provider, stalledSection);
  const { sessionItem: deadItem } = await getOnlyWorktreeAndSession(provider, deadSection);
  assert.match(blockedItem.description, /^blocked · \d+[smhd]/);
  assert.equal(blockedItem.iconPath.id, 'warning');
  assert.match(workingItem.description, /^working · 1 file · /);
  assert.equal(workingItem.iconPath.id, 'loading~spin');
  assert.match(idleItem.description, /^idle · \d+[smhd]/);
  assert.equal(idleItem.iconPath.id, 'comment-discussion');
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

test('active-agents extension watches active sessions, lock files, logs, and session git indexes', async () => {
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
      '**/{.omx,.omc}/agent-worktrees/**/AGENT.lock',
      '**/.omx/logs/*.log',
      path.join(worktreePath, '.git', 'index'),
    ],
  );

  currentSessionFiles = [];
  fs.unlinkSync(sessionPath);
  registrations.fileWatchers[0].fireDelete({ fsPath: sessionPath });
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flushAsyncWork();

  assert.equal(registrations.fileWatchers[4].disposed, true);

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
  registrations.fileWatchers[2].fireChange({ fsPath: path.join(tempRoot, '.omx', 'agent-worktrees', 'agent__codex__a', 'AGENT.lock') });
  registrations.fileWatchers[3].fireChange({ fsPath: path.join(tempRoot, '.omx', 'logs', 'agent-agent__codex__a.log') });
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
  const { sessionItem } = await getOnlyWorktreeAndSession(provider, workingSection);
  registrations.treeViews[0].fireSelection([sessionItem]);

  assert.equal(
    registrations.sourceControls[0].inputBox.placeholder,
    `Commit ${sessionItem.session.agentName} · ${sessionItem.session.taskName} on ${sessionItem.session.branch} · 0 locks (Ctrl+Enter)`,
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
  const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, idleSection);
  assert.equal(worktreeItem.label, `${path.basename(worktreePath)}`);
  assert.equal(sessionItem.label, branch);
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
    const { worktreeItem, sessionItem } = await getOnlyWorktreeAndSession(provider, thinkingSection);
    assert.equal(worktreeItem.label, `${path.basename(worktreePath)}`);
    assert.equal(sessionItem.label, branch);
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
    const { worktreeItem: updatedWorktreeItem, sessionItem: updatedSessionItem } = await getOnlyWorktreeAndSession(provider, updatedThinkingSection);
    assert.equal(updatedWorktreeItem.label, `${path.basename(worktreePath)}`);
    assert.equal(updatedSessionItem.label, branch);

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
  const { sessionItem } = await getOnlyWorktreeAndSession(provider, idleSection);

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

test('active-agents extension opens and refreshes the inspect panel from shared watcher events', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-inspect-panel-'));
  const remoteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-inspect-remote-'));
  const branch = 'agent/codex/inspect-task';

  initGitRepo(tempRoot);
  runGit(tempRoot, ['checkout', '-b', 'main']);
  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\n', 'utf8');
  runGit(tempRoot, ['add', 'tracked.txt']);
  runGit(tempRoot, ['commit', '-m', 'baseline']);
  runGit(remoteRoot, ['init', '--bare']);
  runGit(tempRoot, ['remote', 'add', 'origin', remoteRoot]);
  runGit(tempRoot, ['push', '-u', 'origin', 'main']);
  runGit(tempRoot, ['config', 'multiagent.baseBranch', 'main']);
  runGit(tempRoot, ['checkout', '-b', branch]);
  fs.writeFileSync(path.join(tempRoot, 'tracked.txt'), 'base\ninspect\n', 'utf8');
  runGit(tempRoot, ['add', 'tracked.txt']);
  runGit(tempRoot, ['commit', '-m', 'inspect ahead commit']);

  const sessionPath = sessionSchema.sessionFilePathForBranch(tempRoot, branch);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(sessionSchema.buildSessionRecord({
      repoRoot: tempRoot,
      branch,
      taskName: 'inspect-task',
      agentName: 'codex',
      worktreePath: tempRoot,
      pid: process.pid,
      cliName: 'codex',
    }), null, 2)}\n`,
    'utf8',
  );

  const lockPath = path.join(tempRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    locks: {
      'src/owned-file.txt': {
        branch,
        claimed_at: '2026-04-22T09:13:00.000Z',
        allow_delete: false,
      },
    },
  }, null, 2)}\n`, 'utf8');

  const logPath = path.join(
    tempRoot,
    '.omx',
    'logs',
    `agent-${sessionSchema.sanitizeBranchForFile(branch)}.log`,
  );
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, 'log line 1\n', 'utf8');

  const { registrations, vscode } = createMockVscode(tempRoot);
  vscode.workspace.findFiles = async (pattern) => {
    if (pattern === '**/.omx/state/active-sessions/*.json') {
      return [{ fsPath: sessionPath }];
    }
    return [];
  };
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };

  extension.activate(context);
  await flushAsyncWork();

  const provider = registrations.providers[0].provider;
  const [repoItem] = await provider.getChildren();
  const [agentsSection] = await provider.getChildren(repoItem);
  const [groupSection] = await provider.getChildren(agentsSection);
  const { sessionItem } = await getOnlyWorktreeAndSession(provider, groupSection);

  await registrations.commands.get('gitguardex.activeAgents.inspect')(sessionItem.session);

  assert.equal(registrations.webviewPanels.length, 1);
  const panel = registrations.webviewPanels[0];
  assert.equal(panel.viewType, 'gitguardex.activeAgents.inspect');
  assert.match(panel.title, /Inspect inspect-task/);
  assert.match(panel.webview.html, /origin\/main/);
  assert.match(panel.webview.html, /1 ahead/);
  assert.match(panel.webview.html, /0 behind/);
  assert.match(panel.webview.html, /src\/owned-file.txt/);
  assert.match(panel.webview.html, /log line 1/);

  fs.writeFileSync(logPath, 'log line 1\nlog line 2\n', 'utf8');
  const logWatcher = registrations.watchers.find((watcher) => watcher.pattern === '**/.omx/logs/*.log');
  assert.ok(logWatcher, 'expected log watcher registration');
  logWatcher.fireChange({ fsPath: logPath });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await flushAsyncWork();

  assert.match(panel.webview.html, /log line 2/);

  await registrations.commands.get('gitguardex.activeAgents.inspect')(sessionItem.session);
  assert.equal(registrations.webviewPanels.length, 1);
  assert.equal(panel.revealCalls.length, 1);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension confirms stop and routes through gx agents stop --pid', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-stop-session-'));
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-vscode-stop-worktree-'));
  const { registrations, vscode } = createMockVscode(tempRoot);
  const extension = loadExtensionWithMockVscode(vscode);
  const context = { subscriptions: [] };
  let execCall = null;
  const originalExecFile = cp.execFile;

  vscode.window.showWarningMessage = async (...args) => {
    registrations.warningMessages.push(args);
    return 'Stop';
  };
  cp.execFile = (command, args, options, callback) => {
    execCall = { command, args, options };
    callback(null, '[gx] Stopped agent pid 4242 (stopped).\n', '');
  };

  try {
    extension.activate(context);
    const provider = registrations.providers[0].provider;
    await flushAsyncWork();
    provider.onDidChangeTreeDataEmitter.fireCount = 0;

    await registrations.commands.get('gitguardex.activeAgents.stopSession')({
      label: 'live-task',
      branch: 'agent/codex/live-task',
      pid: 4242,
      repoRoot: tempRoot,
      worktreePath,
    });
    await flushAsyncWork();
  } finally {
    cp.execFile = originalExecFile;
  }

  assert.deepEqual(execCall, {
    command: 'gx',
    args: ['agents', 'stop', '--pid', '4242', '--target', tempRoot],
    options: {
      cwd: tempRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    },
  });
  assert.ok(registrations.providers[0].provider.onDidChangeTreeDataEmitter.fireCount >= 1);
  assert.equal(registrations.warningMessages.length, 1);
  assert.match(registrations.warningMessages[0][0], /Stop live-task\?/);
  assert.match(registrations.warningMessages[0][1].detail, /gx agents stop --pid 4242/);

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});

test('active-agents extension opens the selected changed file through the Git diff UI', async () => {
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

  const relativePath = path.relative(tempRoot, path.join(worktreePath, 'tracked.txt')).replace(/\\/g, '/');
  await registrations.commands.get('gitguardex.activeAgents.openSessionDiff')({
    label: 'live-task',
    repoRoot: tempRoot,
    worktreePath,
    changedPaths: [relativePath],
  });

  assert.equal(registrations.openedDocuments.length, 0);
  assert.equal(registrations.shownDocuments.length, 0);
  const openChangeCalls = registrations.executedCommands
    .filter((entry) => entry.command === 'git.openChange')
    .map((entry) => [entry.command, entry.args[0]?.fsPath || null]);
  assert.deepEqual(
    openChangeCalls,
    [['git.openChange', path.join(worktreePath, 'tracked.txt')]],
  );

  for (const subscription of context.subscriptions) {
    subscription.dispose?.();
  }
});
