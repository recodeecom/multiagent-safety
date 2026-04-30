const {
  test,
  assert,
  fs,
  path,
  runNode,
  runNodeWithEnv,
  runCmd,
  initRepo,
  seedCommit,
} = require('./helpers/install-test-helpers');
const { EventEmitter } = require('node:events');

const { startInteractiveAgentPanel } = require('../src/agents/start');

test('gx agents start dry-run prints the planned codex branch, worktree, and launch without side effects', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const result = runNodeWithEnv(
    ['agents', 'start', 'fix auth tests', '--agent', 'codex', '--base', 'main', '--dry-run'],
    repoDir,
    { GUARDEX_BRANCH_TIMESTAMP: '2026-04-29-21-30' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[gitguardex\] Agents start dry-run:/);
  assert.match(result.stdout, /task slug: fix-auth-tests/);
  assert.match(result.stdout, /branch: agent\/codex\/fix-auth-tests-2026-04-29-21-30/);
  assert.match(
    result.stdout,
    new RegExp(`worktree: ${repoDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\.omx/agent-worktrees/[^\\n]*codex__fix-auth-tests-2026-04-29-21-30`),
  );
  assert.match(result.stdout, /launch: cd '.*' && 'codex' 'fix auth tests'/);
  assert.match(result.stdout, /No branch, worktree, session metadata, or agent process was created\./);

  const branchCheck = runCmd(
    'git',
    ['show-ref', '--verify', '--quiet', 'refs/heads/agent/codex/fix-auth-tests-2026-04-29-21-30'],
    repoDir,
  );
  assert.notEqual(branchCheck.status, 0, 'dry-run must not create a branch');
  assert.equal(
    fs.existsSync(path.join(repoDir, '.omx', 'agent-worktrees', 'repo__codex__fix-auth-tests-2026-04-29-21-30')),
    false,
    'dry-run must not create a worktree',
  );
  assert.equal(
    fs.existsSync(path.join(repoDir, '.omx', 'state', 'agents-bots.json')),
    false,
    'dry-run must not write session metadata',
  );
});

test('gx agents start dry-run supports claude worktree planning and rejects unknown agents', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const claudeResult = runNodeWithEnv(
    ['agents', 'start', 'update docs', '--agent', 'claude', '--dry-run'],
    repoDir,
    { GUARDEX_BRANCH_TIMESTAMP: '2026-04-29-21-31' },
  );
  assert.equal(claudeResult.status, 0, claudeResult.stderr || claudeResult.stdout);
  assert.match(claudeResult.stdout, /branch: agent\/claude\/update-docs-2026-04-29-21-31/);
  assert.match(claudeResult.stdout, /\.omc\/agent-worktrees\/[^ \n]*claude__update-docs-2026-04-29-21-31/);
  assert.match(claudeResult.stdout, /launch: cd '.*' && 'claude' 'update docs'/);

  const invalidResult = runNode(
    ['agents', 'start', 'update docs', '--agent', 'bogus', '--dry-run'],
    repoDir,
  );
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stderr, /Unknown agent id: bogus/);
});

test('gx agents start dry-run renders a terminal panel for multiple codex accounts', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const result = runNodeWithEnv(
    ['agents', 'start', 'fix auth tests', '--agent', 'codex', '--count', '3', '--panel', '--base', 'main', '--dry-run'],
    repoDir,
    { GUARDEX_BRANCH_TIMESTAMP: '2026-04-29-21-32' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Select Agent\(s\)/);
  assert.match(result.stdout, /gitguardex/);
  assert.match(result.stdout, /Welcome/);
  assert.match(result.stdout, /Press \[n\] or Enter to create a new agent/);
  assert.match(result.stdout, /Selected: 3\/10/);
  assert.match(result.stdout, /Codex cx x3/);
  assert.match(result.stdout, /Codex accounts: 3/);
  assert.match(result.stdout, /task: fix auth tests/);
  assert.match(result.stdout, /branch: agent\/codex\/fix-auth-tests-codex-01-2026-04-29-21-32/);
  assert.match(result.stdout, /branch: agent\/codex\/fix-auth-tests-codex-02-2026-04-29-21-32/);
  assert.match(result.stdout, /branch: agent\/codex\/fix-auth-tests-codex-03-2026-04-29-21-32/);
  assert.match(result.stdout, /prompt: fix auth tests/);

  const branchCheck = runCmd(
    'git',
    ['show-ref', '--verify', '--quiet', 'refs/heads/agent/codex/fix-auth-tests-codex-01-2026-04-29-21-32'],
    repoDir,
  );
  assert.notEqual(branchCheck.status, 0, 'dry-run must not create multi-account branches');
});

test('gx agents start --dry-run --json emits Colony-ready launch plan', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const result = runNodeWithEnv(
    [
      'agents',
      'start',
      'colony dry run',
      '--agent',
      'codex',
      '--base',
      'main',
      '--claim',
      'README.md',
      '--meta',
      'colony.plan=queen-plan',
      '--meta',
      'colony.subtask=2',
      '--meta',
      'colony.task_id=42',
      '--dry-run',
      '--json',
    ],
    repoDir,
    { GUARDEX_BRANCH_TIMESTAMP: '2026-04-30-00-05' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.dryRun, true);
  assert.equal(payload.task, 'colony dry run');
  assert.equal(payload.agent, 'codex');
  assert.equal(payload.base, 'main');
  assert.equal(payload.branch, 'agent/codex/colony-dry-run-2026-04-30-00-05');
  assert.match(payload.worktree, /\.omx\/agent-worktrees\/repo__codex__colony-dry-run-2026-04-30-00-05$/);
  assert.deepEqual(payload.claimedFiles, ['README.md']);
  assert.match(payload.launchCommand, /cd '.*' && 'codex' 'colony dry run'/);
  assert.equal(payload.tmuxSession, null);
  assert.equal(payload.tmuxTarget, null);
  assert.deepEqual(payload.metadata, {
    'colony.plan': 'queen-plan',
    'colony.subtask': '2',
    'colony.task_id': '42',
  });
});

class FakeInput extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.rawModes = [];
    this.encodings = [];
    this.resumed = false;
  }

  setEncoding(encoding) {
    this.encodings.push(encoding);
  }

  setRawMode(enabled) {
    this.rawModes.push(enabled);
  }

  resume() {
    this.resumed = true;
  }
}

test('interactive launcher panel handles keys before emitting dry-run plans', () => {
  const input = new FakeInput();
  const stdout = {
    isTTY: true,
    columns: 120,
    rows: 32,
    chunks: [],
    write(chunk) {
      this.chunks.push(String(chunk));
    },
  };
  const stderr = {
    chunks: [],
    write(chunk) {
      this.chunks.push(String(chunk));
    },
  };
  let done = null;

  const controller = startInteractiveAgentPanel('/repo', {
    task: 'fix auth tests',
    agent: 'codex',
    base: 'main',
    count: 1,
    panel: true,
    dryRun: true,
    claims: [],
  }, {
    stdin: input,
    stdout,
    stderr,
    onDone(result) {
      done = result;
    },
  });

  assert.equal(input.resumed, true);
  assert.deepEqual(input.rawModes, [true]);
  assert.match(stdout.chunks.join(''), /Select Agent\(s\)/);
  assert.match(stdout.chunks.join(''), /\x1b\[94m/);

  controller.dispatch('+');
  controller.dispatch('n');

  assert.deepEqual(input.rawModes, [true, false]);
  assert.equal(done.status, 0);
  assert.equal(stderr.chunks.join(''), '');
  const output = stdout.chunks.join('');
  assert.match(output, /Codex cx x2/);
  assert.match(output, /branch: agent\/codex\/fix-auth-tests-codex-01-/);
  assert.match(output, /branch: agent\/codex\/fix-auth-tests-codex-02-/);
});
