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
