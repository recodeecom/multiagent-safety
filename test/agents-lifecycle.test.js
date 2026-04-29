const {
  test,
  assert,
  fs,
  path,
  runNode,
  runCmd,
  initRepoOnBranch,
  seedCommit,
} = require('./helpers/install-test-helpers');

const { startAgentLane } = require('../src/agents/start');
const { finishAgentSession } = require('../src/agents/finish');
const { readAgentSession } = require('../src/agents/sessions');

function sessionPath(repoRoot, sessionId) {
  return path.join(repoRoot, '.guardex', 'agents', 'sessions', `${sessionId}.json`);
}

function activeSessionPath(repoRoot, sessionId) {
  return path.join(repoRoot, '.omx', 'state', 'active-sessions', `${sessionId}.json`);
}

function writeLockRegistry(repoRoot, branch) {
  const lockPath = path.join(repoRoot, '.omx', 'state', 'agent-file-locks.json');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify({
      locks: {
        'src/lifecycle.js': {
          branch,
          claimed_at: '2026-04-29T20:00:00.000Z',
          allow_delete: false,
        },
      },
    }, null, 2)}\n`,
    'utf8',
  );
}

function makeBranchStartMock(repoRoot, branch, worktreePath) {
  return (assetKey, args, options) => {
    assert.equal(assetKey, 'branchStart');
    assert.equal(options.cwd, repoRoot);
    assert.deepEqual(args, ['--task', 'exercise lifecycle', '--agent', 'codex', '--base', 'main']);

    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
    const result = runCmd('git', ['worktree', 'add', '-b', branch, worktreePath, 'main'], repoRoot);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const configResult = runCmd('git', ['config', `branch.${branch}.guardexBase`, 'main'], repoRoot);
    assert.equal(configResult.status, 0, configResult.stderr || configResult.stdout);

    fs.mkdirSync(path.join(worktreePath, 'src'), { recursive: true });
    fs.writeFileSync(path.join(worktreePath, 'src', 'lifecycle.js'), 'export const lifecycle = true;\n', 'utf8');

    return {
      status: 0,
      stdout: [
        `[agent-branch-start] Created branch: ${branch}`,
        `[agent-branch-start] Worktree: ${worktreePath}`,
        '',
      ].join('\n'),
      stderr: '',
    };
  };
}

test('agents local lane lifecycle resolves one canonical session across start status inspect and finish', () => {
  const repoRoot = initRepoOnBranch('main');
  seedCommit(repoRoot);
  const branch = 'agent/codex/lifecycle';
  const worktreePath = path.join(repoRoot, '.omx', 'agent-worktrees', 'repo__codex__lifecycle');
  const sessionId = 'agent__codex__lifecycle';

  const startResult = startAgentLane(
    repoRoot,
    {
      task: 'exercise lifecycle',
      agent: 'codex',
      base: 'main',
      claims: [],
    },
    { packageAssetRunner: makeBranchStartMock(repoRoot, branch, worktreePath) },
  );

  assert.equal(startResult.status, 0, startResult.stderr || startResult.stdout);
  assert.match(startResult.stdout, /Created branch: agent\/codex\/lifecycle/);
  assert.equal(fs.existsSync(sessionPath(repoRoot, sessionId)), true);
  assert.equal(
    fs.existsSync(activeSessionPath(repoRoot, sessionId)),
    false,
    'agents start must write the finish/status session store, not only active-session telemetry',
  );

  const session = readAgentSession(repoRoot, sessionId);
  assert.equal(session.branch, branch);
  assert.equal(session.worktreePath, worktreePath);
  assert.equal(session.base, 'main');
  assert.equal(session.status, 'active');

  const statusResult = runNode(['agents', 'status', '--target', repoRoot], repoRoot);
  assert.equal(statusResult.status, 0, statusResult.stderr || statusResult.stdout);
  assert.match(statusResult.stdout, /Agent sessions: 1/);
  assert.match(statusResult.stdout, /agent__codex__lifecycle codex active branch=agent\/codex\/lifecycle base=main/);
  assert.match(statusResult.stdout, /worktreeExists=yes locks=0 task=exercise lifecycle/);

  writeLockRegistry(repoRoot, branch);

  const filesResult = runNode(['agents', 'files', '--target', repoRoot, '--branch', branch, '--json'], repoRoot);
  assert.equal(filesResult.status, 0, filesResult.stderr || filesResult.stdout);
  const filesPayload = JSON.parse(filesResult.stdout);
  assert.equal(filesPayload.branch, branch);
  assert.equal(filesPayload.worktreePath, worktreePath);
  assert.deepEqual(filesPayload.files, ['src/lifecycle.js']);

  const diffResult = runNode(['agents', 'diff', '--target', repoRoot, '--branch', branch], repoRoot);
  assert.equal(diffResult.status, 0, diffResult.stderr || diffResult.stdout);
  assert.match(diffResult.stdout, /src\/lifecycle\.js/);
  assert.match(diffResult.stdout, /\+export const lifecycle = true;/);

  const locksResult = runNode(['agents', 'locks', '--target', repoRoot, '--branch', branch, '--json'], repoRoot);
  assert.equal(locksResult.status, 0, locksResult.stderr || locksResult.stdout);
  const locksPayload = JSON.parse(locksResult.stdout);
  assert.deepEqual(
    locksPayload.locks.map((lock) => [lock.file, lock.branch]),
    [['src/lifecycle.js', branch]],
  );

  const finishCalls = [];
  const finishResult = finishAgentSession(
    repoRoot,
    { sessionId, branch: '', finishArgs: ['--no-wait-for-merge'] },
    {
      output: { write() {} },
      finishRunner(args) {
        finishCalls.push(args);
        return { ok: true };
      },
    },
  );

  assert.deepEqual(finishCalls, [[
    '--target',
    repoRoot,
    '--branch',
    branch,
    '--no-wait-for-merge',
  ]]);
  assert.equal(finishResult.session.id, sessionId);
  assert.equal(finishResult.session.branch, branch);
  assert.equal(readAgentSession(repoRoot, sessionId).status, 'pr-opened');
});
