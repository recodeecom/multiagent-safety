const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const vscode = require('vscode');
const {
  formatElapsedFrom,
  readActiveSessions,
  readRepoChanges,
  sanitizeBranchForFile,
} = require('./session-schema.js');

const SESSION_DECORATION_SCHEME = 'gitguardex-agent';
const IDLE_WARNING_MS = 10 * 60 * 1000;
const IDLE_ERROR_MS = 30 * 60 * 1000;
const LOCK_FILE_RELATIVE = path.join('.omx', 'state', 'agent-file-locks.json');
const ACTIVE_SESSION_FILES_GLOB = '**/.omx/state/active-sessions/*.json';
const AGENT_FILE_LOCKS_GLOB = '**/.omx/state/agent-file-locks.json';
const WORKTREE_AGENT_LOCKS_GLOB = '**/{.omx,.omc}/agent-worktrees/**/AGENT.lock';
const SESSION_SCAN_EXCLUDE_GLOB = '**/{node_modules,.git,.omx/agent-worktrees,.omc/agent-worktrees}/**';
const WORKTREE_LOCK_SCAN_EXCLUDE_GLOB = '**/{node_modules,.git}/**';
const SESSION_SCAN_LIMIT = 200;
const REFRESH_DEBOUNCE_MS = 250;
const SESSION_ACTIVITY_GROUPS = [
  { kind: 'blocked', label: 'BLOCKED' },
  { kind: 'working', label: 'WORKING NOW' },
  { kind: 'idle', label: 'IDLE' },
  { kind: 'stalled', label: 'STALLED' },
  { kind: 'dead', label: 'DEAD' },
];
const SESSION_ACTIVITY_ICON_IDS = {
  blocked: 'warning',
  working: 'edit',
  idle: 'loading~spin',
  stalled: 'clock',
  dead: 'error',
};

function sessionDecorationUri(branch) {
  return vscode.Uri.parse(`${SESSION_DECORATION_SCHEME}://${sanitizeBranchForFile(branch)}`);
}

function sessionIdleDecoration(session, now = Date.now()) {
  if (!session) {
    return undefined;
  }

  if (session.activityKind === 'blocked') {
    return {
      badge: '!',
      tooltip: 'blocked',
      color: new vscode.ThemeColor('list.warningForeground'),
    };
  }
  if (session.activityKind === 'dead') {
    return {
      badge: 'x',
      tooltip: 'dead',
      color: new vscode.ThemeColor('list.errorForeground'),
    };
  }
  if (session.activityKind === 'stalled') {
    return {
      badge: '!',
      tooltip: 'stalled',
      color: new vscode.ThemeColor('list.errorForeground'),
    };
  }
  if (session.activityKind === 'working') {
    return undefined;
  }

  const startedAtMs = Date.parse(session.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return undefined;
  }

  const elapsedMs = now - startedAtMs;
  if (elapsedMs > IDLE_ERROR_MS) {
    return {
      badge: '30m+',
      tooltip: 'idle 30m+',
      color: new vscode.ThemeColor('list.errorForeground'),
    };
  }
  if (elapsedMs > IDLE_WARNING_MS) {
    return {
      badge: '10m+',
      tooltip: 'idle 10m+',
      color: new vscode.ThemeColor('list.warningForeground'),
    };
  }

  return undefined;
}

class SessionDecorationProvider {
  constructor(nowProvider = () => Date.now()) {
    this.nowProvider = nowProvider;
    this.sessionsByUri = new Map();
    this.onDidChangeFileDecorationsEmitter = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this.onDidChangeFileDecorationsEmitter.event;
  }

  updateSessions(sessions) {
    this.sessionsByUri = new Map(
      sessions.map((session) => [sessionDecorationUri(session.branch).toString(), session]),
    );
  }

  refresh() {
    this.onDidChangeFileDecorationsEmitter.fire();
  }

  provideFileDecoration(uri) {
    if (!uri || uri.scheme !== SESSION_DECORATION_SCHEME) {
      return undefined;
    }

    return sessionIdleDecoration(this.sessionsByUri.get(uri.toString()), this.nowProvider());
  }
}

class InfoItem extends vscode.TreeItem {
  constructor(label, description = '') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

class RepoItem extends vscode.TreeItem {
  constructor(repoRoot, sessions, changes) {
    super(path.basename(repoRoot), vscode.TreeItemCollapsibleState.Expanded);
    this.repoRoot = repoRoot;
    this.sessions = sessions;
    this.changes = changes;
    const descriptionParts = [];
    const activeCount = countActiveSessions(sessions);
    const deadCount = countSessionsByActivityKind(sessions, 'dead');
    const workingCount = countWorkingSessions(sessions);
    if (activeCount > 0) {
      descriptionParts.push(`${activeCount} active`);
    }
    if (deadCount > 0) {
      descriptionParts.push(`${deadCount} dead`);
    }
    if (workingCount > 0) {
      descriptionParts.push(`${workingCount} working`);
    }
    if (changes.length > 0) {
      descriptionParts.push(`${changes.length} changed`);
    }
    this.description = descriptionParts.join(' · ');
    this.tooltip = [
      repoRoot,
      this.description,
    ].join('\n');
    this.iconPath = new vscode.ThemeIcon('repo');
    this.contextValue = 'gitguardex.repo';
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(label, items, options = {}) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.items = items;
    this.description = options.description
      || (items.length > 0 ? String(items.length) : '');
    this.contextValue = 'gitguardex.section';
  }
}

class SessionItem extends vscode.TreeItem {
  constructor(session, items = []) {
    const lockCount = Number.isFinite(session.lockCount) ? session.lockCount : 0;
    super(
      `${session.label} 🔒 ${lockCount}`,
      items.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );
    this.session = session;
    this.items = items;
    this.resourceUri = sessionDecorationUri(session.branch);
    const descriptionParts = [session.activityLabel || 'thinking'];
    if (session.activityCountLabel) {
      descriptionParts.push(session.activityCountLabel);
    }
    descriptionParts.push(session.elapsedLabel || formatElapsedFrom(session.startedAt));
    this.description = descriptionParts.join(' · ');
    const tooltipLines = [
      session.branch,
      `${session.agentName} · ${session.taskName}`,
      session.latestTaskPreview && session.latestTaskPreview !== session.taskName
        ? `Live task ${session.latestTaskPreview}`
        : '',
      `Status ${this.description}`,
      session.changeCount > 0
        ? `Changed ${session.activityCountLabel}: ${session.activitySummary}`
        : session.activitySummary,
      `Locks ${lockCount}`,
      Number.isInteger(session.pid) && session.pid > 0
        ? session.pidAlive === false
          ? `PID ${session.pid} not alive`
          : `PID ${session.pid} alive`
        : '',
      session.lastFileActivityAt ? `Last file activity ${session.lastFileActivityAt}` : '',
      session.sourceKind === 'worktree-lock'
        ? `Telemetry updated ${session.telemetryUpdatedAt || session.startedAt}`
        : `Started ${session.startedAt}`,
      session.worktreePath,
    ];
    this.tooltip = tooltipLines.filter(Boolean).join('\n');
    this.iconPath = new vscode.ThemeIcon(resolveSessionActivityIconId(session.activityKind));
    this.contextValue = 'gitguardex.session';
    this.command = {
      command: 'gitguardex.activeAgents.openWorktree',
      title: 'Open Agent Worktree',
      arguments: [session],
    };
  }
}

class FolderItem extends vscode.TreeItem {
  constructor(label, relativePath, items) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.relativePath = relativePath;
    this.items = items;
    this.tooltip = relativePath;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'gitguardex.folder';
  }
}

class ChangeItem extends vscode.TreeItem {
  constructor(change) {
    super(path.basename(change.relativePath), vscode.TreeItemCollapsibleState.None);
    this.change = change;
    this.description = change.statusLabel;
    this.tooltip = [
      change.relativePath,
      `Status ${change.statusText}`,
      change.originalPath ? `Renamed from ${change.originalPath}` : '',
      change.hasForeignLock ? `Locked by ${change.lockOwnerBranch}` : '',
      change.absolutePath,
    ].filter(Boolean).join('\n');
    this.resourceUri = vscode.Uri.file(change.absolutePath);
    if (change.hasForeignLock) {
      this.iconPath = new vscode.ThemeIcon('warning');
    }
    this.contextValue = 'gitguardex.change';
    this.command = {
      command: 'gitguardex.activeAgents.openChange',
      title: 'Open Changed File',
      arguments: [change],
    };
  }
}

function shellQuote(value) {
  const normalized = String(value || '');
  return `'${normalized.replace(/'/g, "'\"'\"'")}'`;
}

function sessionDisplayLabel(session) {
  return session?.taskName || session?.label || session?.branch || path.basename(session?.worktreePath || '') || 'session';
}

function sessionWorktreePath(session) {
  return typeof session?.worktreePath === 'string' ? session.worktreePath.trim() : '';
}

function showSessionMessage(message) {
  vscode.window.showInformationMessage?.(message);
}

function ensureSessionWorktree(session, actionLabel) {
  const worktreePath = sessionWorktreePath(session);
  if (!worktreePath) {
    showSessionMessage(`Cannot ${actionLabel}: missing worktree path.`);
    return '';
  }
  if (!fs.existsSync(worktreePath)) {
    showSessionMessage(`Cannot ${actionLabel}: worktree is no longer on disk: ${worktreePath}`);
    return '';
  }
  return worktreePath;
}

function runSessionTerminalCommand(session, actionLabel, iconId, commandText) {
  const worktreePath = ensureSessionWorktree(session, actionLabel.toLowerCase());
  if (!worktreePath) {
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: `GitGuardex ${actionLabel}: ${sessionDisplayLabel(session)}`,
    cwd: worktreePath,
    iconPath: new vscode.ThemeIcon(iconId),
  });
  terminal.show();
  terminal.sendText(commandText, true);
}

function finishSession(session) {
  if (!session?.branch) {
    showSessionMessage('Cannot finish session: missing branch name.');
    return;
  }
  runSessionTerminalCommand(
    session,
    'Finish',
    'check',
    `gx branch finish --branch ${shellQuote(session.branch)}`,
  );
}

function syncSession(session) {
  runSessionTerminalCommand(session, 'Sync', 'sync', 'gx sync');
}

async function stopSession(session, refresh) {
  const pid = Number(session?.pid);
  if (!Number.isInteger(pid) || pid <= 0) {
    showSessionMessage('Cannot stop session: missing pid.');
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Stop ${sessionDisplayLabel(session)}?`,
    { modal: true, detail: `Send SIGTERM to pid ${pid}.` },
    'Stop',
  );
  if (confirmed !== 'Stop') {
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    refresh();
  } catch (error) {
    showSessionMessage(
      `Failed to stop session ${sessionDisplayLabel(session)}: ${error?.message || String(error)}`,
    );
  }
}

async function openSessionDiff(session) {
  const worktreePath = ensureSessionWorktree(session, 'open diff');
  if (!worktreePath) {
    return;
  }

  let diffOutput = '';
  try {
    diffOutput = cp.execFileSync('git', ['-C', worktreePath, 'diff'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = [
      error?.stdout,
      error?.stderr,
      error?.message,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) || 'git diff failed.';
    showSessionMessage(`Failed to open diff for ${sessionDisplayLabel(session)}: ${detail.trim()}`);
    return;
  }

  const document = await vscode.workspace.openTextDocument({
    language: 'diff',
    content: diffOutput,
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

function repoRootFromSessionFile(filePath) {
  return path.resolve(path.dirname(filePath), '..', '..', '..');
}

function repoRootFromWorktreeLockFile(filePath) {
  return path.resolve(path.dirname(filePath), '..', '..', '..');
}

function repoRootFromLockFile(filePath) {
  return path.resolve(path.dirname(filePath), '..', '..');
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function emptyLockRegistry() {
  return {
    entriesByPath: new Map(),
    countsByBranch: new Map(),
  };
}

function readLockRegistry(repoRoot) {
  const lockPath = path.join(repoRoot, LOCK_FILE_RELATIVE);
  if (!fs.existsSync(lockPath)) {
    return emptyLockRegistry();
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (_error) {
    return emptyLockRegistry();
  }

  const locks = parsed?.locks;
  if (!locks || typeof locks !== 'object' || Array.isArray(locks)) {
    return emptyLockRegistry();
  }

  const entriesByPath = new Map();
  const countsByBranch = new Map();
  for (const [rawRelativePath, entry] of Object.entries(locks)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const relativePath = normalizeRelativePath(rawRelativePath);
    const branch = typeof entry.branch === 'string' ? entry.branch.trim() : '';
    if (!relativePath || !branch) {
      continue;
    }

    entriesByPath.set(relativePath, {
      branch,
      claimedAt: typeof entry.claimed_at === 'string' ? entry.claimed_at : '',
      allowDelete: Boolean(entry.allow_delete),
    });
    countsByBranch.set(branch, (countsByBranch.get(branch) || 0) + 1);
  }

  return {
    entriesByPath,
    countsByBranch,
  };
}

function readCurrentBranch(repoRoot) {
  try {
    return cp.execFileSync('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return '';
  }
}

function decorateSession(session, lockRegistry) {
  return {
    ...session,
    lockCount: lockRegistry.countsByBranch.get(session.branch) || 0,
  };
}

function decorateChange(change, lockRegistry, owningBranch) {
  const lockEntry = lockRegistry.entriesByPath.get(normalizeRelativePath(change.relativePath));
  const lockOwnerBranch = lockEntry?.branch || '';
  return {
    ...change,
    lockOwnerBranch,
    hasForeignLock: Boolean(lockOwnerBranch) && (!owningBranch || lockOwnerBranch !== owningBranch),
  };
}

function isPathWithin(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function localizeChangeForSession(session, change) {
  if (!change?.absolutePath || !isPathWithin(session.worktreePath, change.absolutePath)) {
    return null;
  }

  let originalPath = change.originalPath;
  if (originalPath) {
    const originalAbsolutePath = path.join(session.repoRoot, originalPath);
    if (isPathWithin(session.worktreePath, originalAbsolutePath)) {
      originalPath = normalizeRelativePath(path.relative(session.worktreePath, originalAbsolutePath));
    }
  }

  return {
    ...change,
    relativePath: normalizeRelativePath(path.relative(session.worktreePath, change.absolutePath)),
    originalPath,
  };
}

async function findRepoSessionEntries() {
  const [sessionFiles, worktreeLockFiles] = await Promise.all([
    vscode.workspace.findFiles(
      ACTIVE_SESSION_FILES_GLOB,
      SESSION_SCAN_EXCLUDE_GLOB,
      SESSION_SCAN_LIMIT,
    ),
    vscode.workspace.findFiles(
      WORKTREE_AGENT_LOCKS_GLOB,
      WORKTREE_LOCK_SCAN_EXCLUDE_GLOB,
      SESSION_SCAN_LIMIT,
    ),
  ]);

  const repoRoots = new Set();
  for (const uri of sessionFiles) {
    repoRoots.add(repoRootFromSessionFile(uri.fsPath));
  }
  for (const uri of worktreeLockFiles) {
    if (path.basename(uri.fsPath) !== 'AGENT.lock') {
      continue;
    }
    repoRoots.add(repoRootFromWorktreeLockFile(uri.fsPath));
  }

  if (repoRoots.size === 0) {
    for (const workspaceFolder of vscode.workspace.workspaceFolders || []) {
      repoRoots.add(workspaceFolder.uri.fsPath);
    }
  }

  const repoEntries = [];
  for (const repoRoot of repoRoots) {
    const sessions = readActiveSessions(repoRoot, { includeStale: true });
    if (sessions.length > 0) {
      repoEntries.push({ repoRoot, sessions });
    }
  }

  repoEntries.sort((left, right) => left.repoRoot.localeCompare(right.repoRoot));
  return repoEntries;
}

function resolveSessionWatcherKey(session) {
  return `${path.resolve(session.repoRoot)}::${session.branch}::${path.resolve(session.worktreePath)}`;
}

function resolveSessionGitIndexPath(worktreePath) {
  const gitPath = path.join(worktreePath, '.git');
  const defaultIndexPath = path.join(gitPath, 'index');

  try {
    if (fs.statSync(gitPath).isDirectory()) {
      return defaultIndexPath;
    }
  } catch (_error) {
    return defaultIndexPath;
  }

  try {
    const gitPointer = fs.readFileSync(gitPath, 'utf8');
    const match = gitPointer.match(/^gitdir:\s*(.+)$/m);
    if (match?.[1]) {
      return path.resolve(worktreePath, match[1].trim(), 'index');
    }
  } catch (_error) {
    return defaultIndexPath;
  }

  return defaultIndexPath;
}

function bindRefreshWatcher(watcher, refresh) {
  return [
    watcher.onDidCreate(refresh),
    watcher.onDidChange(refresh),
    watcher.onDidDelete(refresh),
  ];
}

function disposeAll(disposables) {
  for (const disposable of disposables) {
    disposable?.dispose?.();
  }
}

function buildChangeTreeNodes(changes) {
  const root = [];

  function sortNodes(nodes) {
    nodes.sort((left, right) => {
      const leftIsFolder = left.kind === 'folder';
      const rightIsFolder = right.kind === 'folder';
      if (leftIsFolder !== rightIsFolder) {
        return leftIsFolder ? -1 : 1;
      }
      return left.label.localeCompare(right.label);
    });

    for (const node of nodes) {
      if (node.kind === 'folder') {
        sortNodes(node.children);
      }
    }
  }

  for (const change of changes) {
    const segments = change.relativePath.split(/[\\/]+/).filter(Boolean);
    if (segments.length <= 1) {
      root.push({ kind: 'change', label: change.relativePath, change });
      continue;
    }

    let nodes = root;
    let folderPath = '';
    for (const segment of segments.slice(0, -1)) {
      folderPath = folderPath ? path.posix.join(folderPath, segment) : segment;
      let folderNode = nodes.find((node) => node.kind === 'folder' && node.relativePath === folderPath);
      if (!folderNode) {
        folderNode = {
          kind: 'folder',
          label: segment,
          relativePath: folderPath,
          children: [],
        };
        nodes.push(folderNode);
      }
      nodes = folderNode.children;
    }

    nodes.push({ kind: 'change', label: change.relativePath, change });
  }

  sortNodes(root);

  function materialize(nodes) {
    return nodes.map((node) => {
      if (node.kind === 'folder') {
        return new FolderItem(node.label, node.relativePath, materialize(node.children));
      }
      return new ChangeItem(node.change);
    });
  }

  return materialize(root);
}

function countWorkingSessions(sessions) {
  return sessions.filter((session) => session.activityKind === 'working').length;
}

function buildGroupedChangeTreeNodes(sessions, changes) {
  const changesBySession = new Map();
  const sessionByChangedPath = new Map();
  const repoRootChanges = [];

  for (const session of sessions) {
    changesBySession.set(session.branch, []);
    for (const changedPath of session.changedPaths || []) {
      if (!sessionByChangedPath.has(changedPath)) {
        sessionByChangedPath.set(changedPath, session);
      }
    }
  }

  for (const change of changes) {
    const normalizedRelativePath = normalizeRelativePath(change.relativePath);
    const session = sessionByChangedPath.get(normalizedRelativePath)
      || sessions.find((candidate) => isPathWithin(candidate.worktreePath, change.absolutePath));
    if (!session) {
      repoRootChanges.push(change);
      continue;
    }

    const localizedChange = localizeChangeForSession(session, change);
    if (!localizedChange) {
      repoRootChanges.push(change);
      continue;
    }

    changesBySession.get(session.branch).push(localizedChange);
  }

  const items = sessions
    .map((session) => {
      const sessionChanges = changesBySession.get(session.branch) || [];
      if (sessionChanges.length === 0) {
        return null;
      }
      return new SessionItem(session, buildChangeTreeNodes(sessionChanges));
    })
    .filter(Boolean);

  if (repoRootChanges.length > 0) {
    items.push(new SectionItem('Repo root', buildChangeTreeNodes(repoRootChanges), {
      description: String(repoRootChanges.length),
    }));
  }

  return items;
}

function countActiveSessions(sessions) {
  return sessions.filter((session) => session.activityKind !== 'dead').length;
}

function countSessionsByActivityKind(sessions, activityKind) {
  return sessions.filter((session) => session.activityKind === activityKind).length;
}

function resolveSessionActivityIconId(activityKind) {
  return SESSION_ACTIVITY_ICON_IDS[activityKind] || 'loading~spin';
}

async function pickRepoRoot() {
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  if (workspaceFolders.length === 0) {
    vscode.window.showInformationMessage?.('Open a Guardex workspace folder to start an agent.');
    return null;
  }

  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  }

  const picks = workspaceFolders.map((folder) => ({
    label: path.basename(folder.uri.fsPath),
    description: folder.uri.fsPath,
    repoRoot: folder.uri.fsPath,
  }));
  const selection = await vscode.window.showQuickPick?.(picks, {
    placeHolder: 'Select the Guardex repo where gx branch start should run.',
  });
  return selection?.repoRoot || null;
}

async function promptStartAgentDetails() {
  const taskName = await vscode.window.showInputBox?.({
    prompt: 'Task for gx branch start',
    placeHolder: 'vscode active agents welcome view',
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? undefined : 'Task is required.',
  });
  if (!taskName) {
    return null;
  }

  const agentName = await vscode.window.showInputBox?.({
    prompt: 'Agent name for gx branch start',
    placeHolder: 'codex',
    value: 'codex',
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? undefined : 'Agent name is required.',
  });
  if (!agentName) {
    return null;
  }

  return {
    taskName: taskName.trim(),
    agentName: agentName.trim(),
  };
}

async function startAgentFromPrompt(refresh) {
  const repoRoot = await pickRepoRoot();
  if (!repoRoot) {
    return;
  }

  const details = await promptStartAgentDetails();
  if (!details) {
    return;
  }

  const terminal = vscode.window.createTerminal?.({
    name: `GitGuardex: ${path.basename(repoRoot)}`,
    cwd: repoRoot,
  });
  terminal?.show(true);
  terminal?.sendText(
    `gx branch start ${shellQuote(details.taskName)} ${shellQuote(details.agentName)}`,
    true,
  );
  refresh();
}

function sessionSelectionKey(session) {
  if (!session?.repoRoot || !session?.branch) {
    return '';
  }

  return `${session.repoRoot}::${session.branch}`;
}

function formatGitCommandFailure(error) {
  for (const value of [error?.stderr, error?.stdout, error?.message]) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return 'Git command failed.';
}

function runGitCommand(worktreePath, args) {
  return cp.execFileSync('git', ['-C', worktreePath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function stageWorktreeForCommit(worktreePath) {
  runGitCommand(worktreePath, ['add', '-A', '--', '.', `:(exclude)${LOCK_FILE_RELATIVE}`]);
}

function commitWorktree(worktreePath, message) {
  runGitCommand(worktreePath, ['commit', '-m', message]);
}

function buildActiveAgentGroupNodes(sessions) {
  const groups = [];
  for (const group of SESSION_ACTIVITY_GROUPS) {
    const groupSessions = sessions
      .filter((session) => session.activityKind === group.kind)
      .map((session) => new SessionItem(session));
    if (groupSessions.length > 0) {
      groups.push(new SectionItem(group.label, groupSessions));
    }
  }

  return groups;
}

class ActiveAgentsProvider {
  constructor(decorationProvider) {
    this.decorationProvider = decorationProvider;
    this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    this.onDidChangeSelectedSessionEmitter = new vscode.EventEmitter();
    this.onDidChangeSelectedSession = this.onDidChangeSelectedSessionEmitter.event;
    this.treeView = null;
    this.lockRegistryByRepoRoot = new Map();
    this.selectedSession = null;
  }

  getTreeItem(element) {
    return element;
  }

  attachTreeView(treeView) {
    this.treeView = treeView;
    this.updateViewState(0, 0, 0);
    treeView.onDidChangeSelection?.((event) => {
      const sessionItem = event.selection.find((item) => item instanceof SessionItem);
      this.setSelectedSession(sessionItem?.session || null);
    });
  }

  setSelectedSession(session) {
    const nextSession = session?.worktreePath ? { ...session } : null;
    const currentKey = sessionSelectionKey(this.selectedSession);
    const nextKey = sessionSelectionKey(nextSession);
    this.selectedSession = nextSession;
    if (currentKey !== nextKey) {
      this.onDidChangeSelectedSessionEmitter.fire(this.selectedSession);
    }
  }

  getSelectedSession() {
    return this.selectedSession ? { ...this.selectedSession } : null;
  }

  syncSelectedSession(repoEntries) {
    if (!this.selectedSession) {
      return;
    }

    const nextSession = repoEntries
      .flatMap((entry) => entry.sessions)
      .find((session) => sessionSelectionKey(session) === sessionSelectionKey(this.selectedSession));
    this.setSelectedSession(nextSession || null);
  }

  updateViewState(sessionCount, workingCount, deadCount) {
    if (!this.treeView) {
      return;
    }

    const activeCount = Math.max(0, sessionCount - deadCount);
    const badgeTooltipParts = [];
    if (activeCount > 0) {
      badgeTooltipParts.push(`${activeCount} active agent${activeCount === 1 ? '' : 's'}`);
    }
    if (deadCount > 0) {
      badgeTooltipParts.push(`${deadCount} dead`);
    }
    if (workingCount > 0) {
      badgeTooltipParts.push(`${workingCount} working now`);
    }

    this.treeView.badge = sessionCount > 0
      ? {
          value: sessionCount,
          tooltip: badgeTooltipParts.join(' · '),
        }
      : undefined;
    this.treeView.message = sessionCount > 0
      ? undefined
      : 'Start a sandbox session to populate this view.';
  }

  async syncRepoEntries() {
    const repoEntries = await this.loadRepoEntries();
    const sessionCount = repoEntries.reduce((total, entry) => total + entry.sessions.length, 0);
    const workingCount = repoEntries.reduce(
      (total, entry) => total + countWorkingSessions(entry.sessions),
      0,
    );
    const deadCount = repoEntries.reduce(
      (total, entry) => total + countSessionsByActivityKind(entry.sessions, 'dead'),
      0,
    );

    this.updateViewState(sessionCount, workingCount, deadCount);
    this.decorationProvider?.updateSessions(repoEntries.flatMap((entry) => entry.sessions));
    return repoEntries;
  }

  async refresh() {
    await this.syncRepoEntries();
    this.onDidChangeTreeDataEmitter.fire();
    this.decorationProvider?.refresh();
  }

  readLockRegistryForRepo(repoRoot) {
    const lockRegistry = readLockRegistry(repoRoot);
    this.lockRegistryByRepoRoot.set(repoRoot, lockRegistry);
    return lockRegistry;
  }

  getLockRegistryForRepo(repoRoot) {
    return this.lockRegistryByRepoRoot.get(repoRoot) || this.readLockRegistryForRepo(repoRoot);
  }

  refreshLockRegistryForFile(filePath) {
    this.readLockRegistryForRepo(repoRootFromLockFile(filePath));
  }

  readLockRegistryForRepo(repoRoot) {
    const lockRegistry = readLockRegistry(repoRoot);
    this.lockRegistryByRepoRoot.set(repoRoot, lockRegistry);
    return lockRegistry;
  }

  getLockRegistryForRepo(repoRoot) {
    return this.lockRegistryByRepoRoot.get(repoRoot) || this.readLockRegistryForRepo(repoRoot);
  }

  refreshLockRegistryForFile(filePath) {
    this.readLockRegistryForRepo(repoRootFromLockFile(filePath));
  }

  async getChildren(element) {
    if (element instanceof RepoItem) {
      const sectionItems = [
        new SectionItem('ACTIVE AGENTS', buildActiveAgentGroupNodes(element.sessions), {
          description: String(element.sessions.length),
        }),
      ];
      if (element.changes.length > 0) {
        sectionItems.push(new SectionItem('CHANGES', buildGroupedChangeTreeNodes(element.sessions, element.changes), {
          description: String(element.changes.length),
        }));
      }
      return sectionItems;
    }

    if (element instanceof SectionItem || element instanceof FolderItem || element instanceof SessionItem) {
      return element.items;
    }

    const repoEntries = await this.syncRepoEntries();
    this.syncSelectedSession(repoEntries);

    if (repoEntries.length === 0) {
      return [new InfoItem('No active Guardex agents', 'Open or start a sandbox session.')];
    }

    return repoEntries.map((entry) => new RepoItem(entry.repoRoot, entry.sessions, entry.changes));
  }

  async loadRepoEntries() {
    const repoEntries = await findRepoSessionEntries();
    return repoEntries.map((entry) => {
      const repoRoot = entry.repoRoot;
      const lockRegistry = this.getLockRegistryForRepo(repoRoot);
      const currentBranch = readCurrentBranch(repoRoot);
      return {
        repoRoot,
        sessions: entry.sessions.map((session) => decorateSession(session, lockRegistry)),
        changes: readRepoChanges(repoRoot).map((change) => (
          decorateChange(change, lockRegistry, currentBranch)
        )),
      };
    });
  }
}

class ActiveAgentsRefreshController {
  constructor(provider) {
    this.provider = provider;
    this.refreshTimer = null;
    this.sessionWatchers = new Map();
  }

  scheduleRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshNow();
    }, REFRESH_DEBOUNCE_MS);
  }

  async refreshNow() {
    await this.syncSessionWatchers();
    await this.provider.refresh();
  }

  async syncSessionWatchers() {
    const repoEntries = await findRepoSessionEntries();
    const liveSessionKeys = new Set();

    for (const entry of repoEntries) {
      for (const session of entry.sessions) {
        const sessionKey = resolveSessionWatcherKey(session);
        liveSessionKeys.add(sessionKey);
        if (this.sessionWatchers.has(sessionKey)) {
          continue;
        }

        const watcher = vscode.workspace.createFileSystemWatcher(
          resolveSessionGitIndexPath(session.worktreePath),
        );
        const disposables = bindRefreshWatcher(watcher, () => this.scheduleRefresh());
        this.sessionWatchers.set(sessionKey, { watcher, disposables });
      }
    }

    for (const [sessionKey, entry] of this.sessionWatchers) {
      if (liveSessionKeys.has(sessionKey)) {
        continue;
      }

      disposeAll(entry.disposables);
      entry.watcher.dispose();
      this.sessionWatchers.delete(sessionKey);
    }
  }

  dispose() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    for (const entry of this.sessionWatchers.values()) {
      disposeAll(entry.disposables);
      entry.watcher.dispose();
    }
    this.sessionWatchers.clear();
  }
}

function activate(context) {
  const decorationProvider = new SessionDecorationProvider();
  const provider = new ActiveAgentsProvider(decorationProvider);
  const refreshController = new ActiveAgentsRefreshController(provider);
  const treeView = vscode.window.createTreeView('gitguardex.activeAgents', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  const sourceControl = vscode.scm.createSourceControl(
    'gitguardex.activeAgents.commitInput',
    'Active Agents Commit',
  );
  provider.attachTreeView(treeView);
  const scheduleRefresh = () => refreshController.scheduleRefresh();
  const refresh = () => void refreshController.refreshNow();
  const activeSessionsWatcher = vscode.workspace.createFileSystemWatcher(ACTIVE_SESSION_FILES_GLOB);
  const lockWatcher = vscode.workspace.createFileSystemWatcher(AGENT_FILE_LOCKS_GLOB);
  const worktreeLockWatcher = vscode.workspace.createFileSystemWatcher(WORKTREE_AGENT_LOCKS_GLOB);
  const updateCommitInput = (session) => {
    sourceControl.inputBox.enabled = true;
    sourceControl.inputBox.visible = true;
    sourceControl.inputBox.placeholder = session?.label
      ? `Commit ${session.label} (Ctrl+Enter)`
      : 'Pick an Active Agents session to commit its worktree.';
  };
  updateCommitInput(null);
  const commitSelectedSession = async () => {
    const selectedSession = provider.getSelectedSession();
    if (!selectedSession?.worktreePath) {
      vscode.window.showInformationMessage?.('Pick an Active Agents session first.');
      return;
    }

    const message = String(sourceControl.inputBox.value || '').trim();
    if (!message) {
      vscode.window.showInformationMessage?.('Enter a commit message first.');
      return;
    }

    if (!fs.existsSync(selectedSession.worktreePath)) {
      vscode.window.showInformationMessage?.(
        `Selected session worktree is no longer on disk: ${selectedSession.worktreePath}`,
      );
      return;
    }

    try {
      stageWorktreeForCommit(selectedSession.worktreePath);
      commitWorktree(selectedSession.worktreePath, message);
      sourceControl.inputBox.value = '';
      refresh();
    } catch (error) {
      const failure = formatGitCommandFailure(error);
      if (/nothing to commit|no changes added to commit/i.test(failure)) {
        vscode.window.showInformationMessage?.(`No changes to commit in ${selectedSession.label}.`);
        return;
      }
      vscode.window.showErrorMessage?.(`Active Agents commit failed: ${failure}`);
    }
  };
  sourceControl.acceptInputCommand = {
    command: 'gitguardex.activeAgents.commitSelectedSession',
    title: 'Commit Selected Session',
  };
  const interval = setInterval(refresh, 5_000);
  const refreshLockRegistry = (uri) => {
    if (uri?.fsPath) {
      provider.refreshLockRegistryForFile(uri.fsPath);
    }
    scheduleRefresh();
  };

  provider.onDidChangeSelectedSession(updateCommitInput);

  context.subscriptions.push(
    treeView,
    sourceControl,
    refreshController,
    vscode.window.registerFileDecorationProvider(decorationProvider),
    vscode.commands.registerCommand('gitguardex.activeAgents.startAgent', () => startAgentFromPrompt(refresh)),
    vscode.commands.registerCommand('gitguardex.activeAgents.refresh', refresh),
    vscode.commands.registerCommand('gitguardex.activeAgents.commitSelectedSession', commitSelectedSession),
    vscode.commands.registerCommand('gitguardex.activeAgents.openWorktree', async (session) => {
      if (!session?.worktreePath) {
        return;
      }

      await vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(session.worktreePath),
        { forceNewWindow: true },
      );
    }),
    vscode.commands.registerCommand('gitguardex.activeAgents.openChange', async (change) => {
      if (!change?.absolutePath) {
        return;
      }

      if (!fs.existsSync(change.absolutePath)) {
        vscode.window.showInformationMessage?.(`Changed path is no longer on disk: ${change.relativePath}`);
        return;
      }

      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(change.absolutePath));
    }),
    vscode.commands.registerCommand('gitguardex.activeAgents.finishSession', finishSession),
    vscode.commands.registerCommand('gitguardex.activeAgents.syncSession', syncSession),
    vscode.commands.registerCommand('gitguardex.activeAgents.stopSession', (session) => stopSession(session, refresh)),
    vscode.commands.registerCommand('gitguardex.activeAgents.openSessionDiff', openSessionDiff),
    vscode.workspace.onDidChangeWorkspaceFolders(scheduleRefresh),
    activeSessionsWatcher,
    lockWatcher,
    worktreeLockWatcher,
    { dispose: () => clearInterval(interval) },
  );

  context.subscriptions.push(
    ...bindRefreshWatcher(activeSessionsWatcher, scheduleRefresh),
    ...bindRefreshWatcher(lockWatcher, refreshLockRegistry),
    ...bindRefreshWatcher(worktreeLockWatcher, scheduleRefresh),
  );
  void refreshController.refreshNow();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
