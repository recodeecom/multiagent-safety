const {
  test,
  assert,
  fs,
  path,
  runNode,
  initRepo,
  seedCommit,
  extractCreatedBranch,
  extractCreatedWorktree,
  defineSpawnSuite,
} = require('./helpers/install-test-helpers');
const { finishAgentSession } = require('../src/agents/finish');
const { listAgentSessions, readAgentSession } = require('../src/agents/sessions');

function readLocks(worktreePath) {
  const lockPath = path.join(worktreePath, '.omx', 'state', 'agent-file-locks.json');
  if (!fs.existsSync(lockPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(lockPath, 'utf8')).locks || {};
}

defineSpawnSuite('agents start claim suite', () => {
  test('agents start creates an agent lane without claims', () => {
    const repoDir = initRepo();
    seedCommit(repoDir);

    const result = runNode(['agents', 'start', 'fix auth', '--agent', 'codex', '--target', repoDir], repoDir);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\[agent-branch-start\] Created branch: agent\/codex\//);
    assert.doesNotMatch(result.stdout, /Claimed 1 file/);

    const worktreePath = extractCreatedWorktree(result.stdout);
    assert.equal(fs.existsSync(path.join(worktreePath, '.omx', 'state', 'agent-file-locks.json')), false);

    const [session] = listAgentSessions(repoDir);
    assert.equal(session.task, 'fix auth');
    assert.equal(session.agent, 'codex');
    assert.equal(session.branch, extractCreatedBranch(result.stdout));
    assert.equal(session.worktreePath, worktreePath);
    assert.equal(session.status, 'active');
  });

  test('agents start claims one file after branch creation', () => {
    const repoDir = initRepo();
    seedCommit(repoDir);

    const result = runNode(
      ['agents', 'start', 'fix auth', '--agent', 'codex', '--claim', 'src/auth.js', '--target', repoDir],
      repoDir,
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Claimed 1 file\(s\)/);

    const branch = extractCreatedBranch(result.stdout);
    const worktreePath = extractCreatedWorktree(result.stdout);
    assert.equal(readLocks(worktreePath)['src/auth.js'].branch, branch);
  });

  test('agents start supports repeated claim flags', () => {
    const repoDir = initRepo();
    seedCommit(repoDir);

    const result = runNode(
      [
        'agents',
        'start',
        'fix auth',
        '--agent',
        'codex',
        '--claim',
        'src/auth.js',
        '--claim',
        'test/auth.test.js',
        '--target',
        repoDir,
      ],
      repoDir,
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Claimed 2 file\(s\)/);

    const branch = extractCreatedBranch(result.stdout);
    const locks = readLocks(extractCreatedWorktree(result.stdout));
    assert.equal(locks['src/auth.js'].branch, branch);
    assert.equal(locks['test/auth.test.js'].branch, branch);
  });

  test('agents start marks claim-failed and prints recovery instructions when claim fails', () => {
    const repoDir = initRepo();
    seedCommit(repoDir);
    const outsidePath = path.join(path.dirname(repoDir), 'outside.js');

    const result = runNode(
      ['agents', 'start', 'fix auth', '--agent', 'codex', '--claim', outsidePath, '--target', repoDir],
      repoDir,
    );
    assert.notEqual(result.status, 0, 'claim failure should fail the command');
    assert.match(result.stderr, /Path is outside repository/);
    assert.match(result.stdout, /Session status: claim-failed/);
    assert.match(result.stdout, /Recovery: cd /);
    assert.match(result.stdout, /Recovery: gx locks claim --branch /);

    const branch = extractCreatedBranch(result.stdout);
    const [session] = listAgentSessions(repoDir);
    assert.equal(session.branch, branch);
    assert.equal(session.status, 'claim-failed');
    assert.deepEqual(session.claimFailure.claims, [outsidePath]);
    assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'state', 'active-sessions')), false);
  });

  test('agents finish resolves a canonical session created by agents start', () => {
    const repoDir = initRepo();
    seedCommit(repoDir);

    const startResult = runNode(['agents', 'start', 'finish started session', '--agent', 'codex', '--target', repoDir], repoDir);
    assert.equal(startResult.status, 0, startResult.stderr || startResult.stdout);

    const [session] = listAgentSessions(repoDir);
    const calls = [];
    const output = { write() {} };
    const result = finishAgentSession(repoDir, { sessionId: session.id, branch: '', finishArgs: ['--no-wait-for-merge'] }, {
      output,
      finishRunner(args) { calls.push(args); return { ok: true }; },
    });

    assert.equal(result.status, 'pr-opened');
    assert.deepEqual(calls, [['--target', repoDir, '--branch', extractCreatedBranch(startResult.stdout), '--no-wait-for-merge']]);
    assert.equal(readAgentSession(repoDir, session.id).status, 'pr-opened');
  });
});
