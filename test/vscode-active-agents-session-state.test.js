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

function runNode(scriptPath, args, options = {}) {
  return cp.spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    ...options,
  });
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

  const sessions = sessionSchema.readActiveSessions(tempRoot);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].label, 'agent__codex__demo-task');

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
