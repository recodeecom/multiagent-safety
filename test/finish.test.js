const {
  test,
  assert,
  fs,
  os,
  path,
  cp,
  cliPath,
  cliVersion,
  canSpawnChildProcesses,
  spawnUnavailableReason,
  createGuardexHomeDir,
  withGuardexHome,
  runNode,
  runNodeWithEnv,
  runBranchStart,
  runBranchFinish,
  runWorktreePrune,
  runLockTool,
  runInternalShell,
  runCodexAgent,
  runReviewBot,
  runPlanInit,
  runChangeInit,
  stripAgentSessionEnv,
  runCmd,
  runHumanCmd,
  assertZeroCopyManagedGitignore,
  createFakeBin,
  createFakeNpmScript,
  createFakeOpenSpecScript,
  createFakeNpxScript,
  createFakeScorecardScript,
  createFakeCodexAuthScript,
  createFakeGhScript,
  createFakeDockerScript,
  fakeReviewBotDaemonScript,
  initRepo,
  initRepoOnBranch,
  createGuardexCompanionHome,
  configureGitIdentity,
  seedCommit,
  seedReleasePackageManifest,
  commitAll,
  attachOriginRemote,
  attachOriginRemoteForBranch,
  createBootstrappedRepo,
  prepareDoctorAutoFinishReadyBranch,
  commitFile,
  aheadBehindCounts,
  escapeRegexLiteral,
  extractCreatedBranch,
  extractCreatedWorktree,
  extractOpenSpecPlanSlug,
  extractOpenSpecChangeSlug,
  expectedMasterplanPlanSlug,
  extractHookCommands,
  isPidAlive,
  waitForPidExit,
  sanitizeSlug,
  defineSpawnSuite,
} = require('./helpers/install-test-helpers');

defineSpawnSuite('finish and cleanup integration suite', () => {

test('agent-branch-finish handles Claude-root worktrees when inferring base from source branch metadata', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  attachOriginRemoteForBranch(repoDir, 'main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runBranchStart(['finish-from-dev', 'bot'], repoDir, { CLAUDECODE: '1' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentBranch = extractCreatedBranch(result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);
  assert.match(agentWorktree, new RegExp(`${escapeRegexLiteral(repoDir)}/\\.omc/agent-worktrees/`));

  commitFile(agentWorktree, 'agent-finish-main.txt', 'merged via inferred main base\n', 'agent change for main');

  result = runCmd('git', ['checkout', '-b', 'helper-finish'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const auxWorktree = path.join(path.dirname(repoDir), 'aux-main-worktree');
  result = runCmd('git', ['worktree', 'add', auxWorktree, 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const finish = runBranchFinish(['--branch', agentBranch], repoDir);
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(finish.stdout, new RegExp(`Merged '${escapeRegexLiteral(agentBranch)}' into 'main'`));

  assert.equal(
    fs.existsSync(path.join(auxWorktree, 'agent-finish-main.txt')),
    true,
    'main worktree should be fast-forwarded after finish',
  );

  const localBranchExists = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${agentBranch}`], repoDir);
  assert.equal(localBranchExists.status, 0, localBranchExists.stderr || localBranchExists.stdout);
});


test('finish command auto-commits dirty agent worktree and runs PR finish flow for the branch', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  attachOriginRemoteForBranch(repoDir, 'main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runBranchStart(['finish-all', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentBranch = extractCreatedBranch(result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);

  fs.writeFileSync(path.join(agentWorktree, 'finisher-note.txt'), 'pending branch finish\n', 'utf8');

  result = runNode(
    ['finish', '--target', repoDir, '--branch', agentBranch, '--base', 'main', '--no-wait-for-merge', '--no-cleanup'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`Finishing '${escapeRegexLiteral(agentBranch)}' -> 'main'`));
  assert.match(result.stdout, /Auto-committed/);
  assert.match(result.stdout, /Finish summary: total=1, success=1, failed=0, autoCommitted=1/);
  assert.equal(fs.existsSync(agentWorktree), true, 'finish --no-cleanup should keep the agent worktree');
  let branchResult = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${agentBranch}`], repoDir);
  assert.equal(branchResult.status, 0, 'finish --no-cleanup should keep the local agent branch');

  const worktreeStatus = runCmd('git', ['status', '--short'], agentWorktree);
  assert.equal(worktreeStatus.status, 0, worktreeStatus.stderr || worktreeStatus.stdout);
  assert.equal(worktreeStatus.stdout.trim(), '', 'agent worktree should be clean after auto-commit');

  const latestSubject = runCmd('git', ['log', '-1', '--pretty=%s'], agentWorktree);
  assert.equal(latestSubject.status, 0, latestSubject.stderr || latestSubject.stdout);
  assert.equal(latestSubject.stdout.trim(), `Auto-finish: ${agentBranch}`);
});


test('agent-branch-finish auto-commits parent gitlink after nested repo finish', () => {
  const parentDir = initRepoOnBranch('main');
  seedCommit(parentDir);

  const childDir = path.join(parentDir, 'packages', 'child');
  fs.mkdirSync(childDir, { recursive: true });
  let result = runCmd('git', ['init', '-b', 'main'], childDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  configureGitIdentity(childDir);
  fs.writeFileSync(
    path.join(childDir, 'package.json'),
    JSON.stringify({ name: 'child', private: true, scripts: {} }, null, 2) + '\n',
    'utf8',
  );
  seedCommit(childDir);
  attachOriginRemoteForBranch(childDir, 'main');

  result = runNode(['setup', '--target', childDir, '--no-global-install', '--no-recursive'], childDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], childDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], childDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], childDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['add', 'packages/child'], parentDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'track child subrepo'], parentDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  fs.writeFileSync(path.join(parentDir, 'unrelated-parent.txt'), 'already staged\n', 'utf8');
  result = runCmd('git', ['add', 'unrelated-parent.txt'], parentDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runBranchStart(['gitlink-finish', 'bot', 'main'], childDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentBranch = extractCreatedBranch(result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);
  commitFile(agentWorktree, 'finished.txt', 'nested branch finished\n', 'finish nested repo');

  result = runBranchFinish([
    '--branch',
    agentBranch,
    '--base',
    'main',
    '--direct-only',
    '--cleanup',
    '--parent-gitlink-commit',
  ], childDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Parent gitlink auto-committed 'packages\/child'/);

  const parentSubject = runCmd('git', ['log', '-1', '--pretty=%s'], parentDir);
  assert.equal(parentSubject.status, 0, parentSubject.stderr || parentSubject.stdout);
  assert.equal(parentSubject.stdout.trim(), 'Update packages/child subrepo pointer');

  const parentCommitFiles = runCmd('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], parentDir);
  assert.equal(parentCommitFiles.status, 0, parentCommitFiles.stderr || parentCommitFiles.stdout);
  assert.deepEqual(parentCommitFiles.stdout.trim().split('\n'), ['packages/child']);

  const stagedParentFiles = runCmd('git', ['diff', '--cached', '--name-only'], parentDir);
  assert.equal(stagedParentFiles.status, 0, stagedParentFiles.stderr || stagedParentFiles.stdout);
  assert.deepEqual(stagedParentFiles.stdout.trim().split('\n'), ['unrelated-parent.txt']);

  const parentStatus = runCmd('git', ['status', '--short', '--', 'packages/child'], parentDir);
  assert.equal(parentStatus.status, 0, parentStatus.stderr || parentStatus.stdout);
  assert.equal(parentStatus.stdout.trim(), '', 'parent gitlink should be committed cleanly');
});


test('agent-branch-finish auto-syncs source branch when behind origin/dev', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-finish-sync-guard'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'agent-finish.txt', 'agent side\n', 'agent side change');

  result = runCmd('git', ['checkout', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'dev-ahead.txt', 'dev ahead\n', 'dev ahead');
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', 'agent/test-finish-sync-guard'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const finish = runBranchFinish(['--branch', 'agent/test-finish-sync-guard'], repoDir);
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(finish.stderr, /agent-sync-guard/);
  assert.match(finish.stderr, /Auto-syncing 'agent\/test-finish-sync-guard' onto origin\/dev before finish/);
  assert.match(finish.stderr, /Auto-sync complete \(behind now: 0\)/);
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-finish-sync-guard' into 'dev' via direct flow and kept source branch\/worktree\./,
  );

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-finish-sync-guard'], repoDir);
  assert.equal(result.status, 0, 'agent branch should stay locally after finish by default');
});


test('agent-branch-finish removes stale source-probe worktrees before creating a fresh probe', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['checkout', '-b', 'agent/test-stale-source-probe'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  commitFile(repoDir, 'agent-stale-source-probe.txt', 'agent branch change\n', 'agent branch change');

  result = runCmd('git', ['checkout', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const sourceProbePath = path.join(
    repoDir,
    '.omx',
    '.tmp-worktrees',
    '__source-probe-agent__test-stale-source-probe-20260422-153300',
  );
  result = runCmd('git', ['worktree', 'add', sourceProbePath, 'agent/test-stale-source-probe'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  fs.writeFileSync(path.join(sourceProbePath, 'agent-stale-source-probe.txt'), 'stale probe dirty change\n', 'utf8');

  const finish = runBranchFinish(['--branch', 'agent/test-stale-source-probe'], repoDir);
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(finish.stderr, /Removing stale source-probe worktree for 'agent\/test-stale-source-probe'/);
  assert.equal(fs.existsSync(sourceProbePath), false, 'stale source-probe worktree should be removed before finish continues');
  result = runCmd('git', ['branch', '--list', '__agent_integrate_dev_*'], repoDir);
  assert.equal(result.stdout.trim(), '', 'temporary integrate branches should be removed after finish exits');
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-stale-source-probe' into 'dev' via direct flow and kept source branch\/worktree\./,
  );
});


test('agent-branch-finish pr mode continues cleanup when gh merge only fails local branch deletion', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-pr-delete-error'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'agent-pr-delete.txt', 'agent change\n', 'agent change');

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/1"
    exit 0
  fi
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  echo "failed to delete local branch $3: error: cannot delete branch '$3' used by worktree at '/tmp/demo-worktree'" >&2
  echo "/usr/bin/git: exit status 1" >&2
  exit 1
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  const finish = runBranchFinish(
    ['--branch', 'agent/test-pr-delete-error', '--mode', 'pr', '--cleanup'],
    repoDir,
    { GUARDEX_GH_BIN: fakeGhPath },
  );
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(
    finish.stderr,
    /PR merged but gh could not delete the local branch \(active worktree\); continuing local cleanup\./,
  );
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-pr-delete-error' into 'dev' via pr flow and cleaned source branch\/worktree\./,
  );

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-pr-delete-error'], repoDir);
  assert.notEqual(result.status, 0, 'agent branch should be deleted locally');

  result = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-pr-delete-error'], repoDir);
  assert.equal(result.stdout.trim(), '', 'agent branch should be deleted on origin');
});


test('agent-branch-finish cleanup succeeds when remote delete reports an already-removed branch', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-pr-remote-delete-race'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'agent-pr-remote-delete.txt', 'agent change\n', 'agent change');

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/2"
    exit 0
  fi
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 1
`);
  const realGit = runCmd('bash', ['-lc', 'command -v git'], repoDir);
  assert.equal(realGit.status, 0, realGit.stderr || realGit.stdout);
  const realGitPath = realGit.stdout.trim();
  const { fakeBin } = createFakeBin('git', `
real_git="${realGitPath}"
if [[ "$1" == "-C" && "$3" == "push" && "$4" == "origin" && "$5" == "--delete" && "$6" == "agent/test-pr-remote-delete-race" ]]; then
  "$real_git" "$@" >/dev/null 2>&1 || true
  echo "error: unable to delete 'agent/test-pr-remote-delete-race': remote ref does not exist" >&2
  echo "error: failed to push some refs to 'origin'" >&2
  exit 1
fi
"$real_git" "$@"
`);

  const finish = runBranchFinish(
    ['--branch', 'agent/test-pr-remote-delete-race', '--mode', 'pr', '--cleanup'],
    repoDir,
    {
      GUARDEX_GH_BIN: fakeGhPath,
      PATH: `${fakeBin}:${process.env.PATH || ''}`,
    },
  );
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(
    finish.stderr,
    /Remote branch 'agent\/test-pr-remote-delete-race' was already deleted; continuing cleanup\./,
  );
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-pr-remote-delete-race' into 'dev' via pr flow and cleaned source branch\/worktree\./,
  );

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-pr-remote-delete-race'], repoDir);
  assert.notEqual(result.status, 0, 'agent branch should be deleted locally');

  result = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-pr-remote-delete-race'], repoDir);
  assert.equal(result.stdout.trim(), '', 'agent branch should be absent on origin');
});

test('agent-branch-finish cleanup tolerates an already-deleted local branch after gh delete warning', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const agentWorktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__local-delete-race');
  result = runCmd(
    'git',
    ['worktree', 'add', '-b', 'agent/test-pr-local-delete-race', agentWorktreePath, 'dev'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(agentWorktreePath, 'local-delete-race.txt'), 'cleanup race\n', 'utf8');
  result = runCmd('git', ['add', 'local-delete-race.txt'], agentWorktreePath);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '--no-verify', '-m', 'local delete race change'], agentWorktreePath);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/local-delete-race"
    exit 0
  fi
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  git_bin="$(command -v git)"
  "$git_bin" -C "${'${GUARDEX_TEST_AGENT_WORKTREE}'}" checkout --detach >/dev/null 2>&1 || true
  "$git_bin" -C "${'${GUARDEX_TEST_REPO_DIR}'}" branch -D "$3" >/dev/null 2>&1 || true
  echo "failed to delete local branch $3: error: cannot delete branch '$3' used by worktree at '${'${GUARDEX_TEST_AGENT_WORKTREE}'}'" >&2
  echo "/usr/bin/git: exit status 1" >&2
  exit 1
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  const finish = runBranchFinish(
    ['--branch', 'agent/test-pr-local-delete-race', '--base', 'dev', '--mode', 'pr', '--cleanup'],
    repoDir,
    {
      GUARDEX_GH_BIN: fakeGhPath,
      GUARDEX_TEST_REPO_DIR: repoDir,
      GUARDEX_TEST_AGENT_WORKTREE: agentWorktreePath,
    },
  );
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(
    finish.stderr,
    /PR merged but gh could not delete the local branch \(active worktree\); continuing local cleanup\./,
  );
  assert.match(
    finish.stderr,
    /Local branch 'agent\/test-pr-local-delete-race' was already deleted; continuing cleanup\./,
  );
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-pr-local-delete-race' into 'dev' via pr flow and cleaned source branch\/worktree\./,
  );

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-pr-local-delete-race'], repoDir);
  assert.notEqual(result.status, 0, 'agent branch should stay deleted locally');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-pr-local-delete-race'], repoDir);
  assert.equal(result.stdout.trim(), '', 'agent branch should be deleted on origin');
});

test('agent-branch-finish cleanup skips duplicate PR creation when the current head already landed in a merged PR', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-pr-merged-head-rerun'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'agent-pr-merged-head-rerun.txt', 'merged head rerun\n', 'merged head rerun change');
  result = runCmd('git', ['push', '-u', 'origin', 'agent/test-pr-merged-head-rerun'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['rev-parse', 'HEAD'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const headSha = result.stdout.trim();

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "list" ]]; then
  if [[ " $* " == *" --state merged "* ]] && [[ " $* " == *" --json state,mergedAt,url,headRefOid "* ]]; then
    printf 'MERGED\\x1f2026-04-22T21:37:13Z\\x1fhttps://example.test/pr/already-merged-head\\n'
    exit 0
  fi
  echo "unexpected gh pr list args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  echo "duplicate PR creation should have been skipped" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  echo "duplicate PR merge should have been skipped" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  const finish = runBranchFinish(
    ['--branch', 'agent/test-pr-merged-head-rerun', '--base', 'dev', '--mode', 'pr', '--cleanup'],
    repoDir,
    {
      GUARDEX_GH_BIN: fakeGhPath,
      GUARDEX_TEST_HEAD_SHA: headSha,
    },
  );
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(
    finish.stderr,
    /Source branch head already landed in a merged PR; skipping new PR creation and continuing cleanup\./,
  );
  assert.match(
    finish.stderr,
    /Merged PR: https:\/\/example\.test\/pr\/already-merged-head/,
  );
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-pr-merged-head-rerun' into 'dev' via pr flow and cleaned source branch\/worktree\./,
  );

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-pr-merged-head-rerun'], repoDir);
  assert.notEqual(result.status, 0, 'agent branch should be deleted locally');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-pr-merged-head-rerun'], repoDir);
  assert.equal(result.stdout.trim(), '', 'agent branch should be deleted on origin');
});


test('agent-branch-finish cleanup succeeds from active agent worktree when base branch is checked out elsewhere', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const agentWorktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__active-cleanup');
  result = runCmd(
    'git',
    ['worktree', 'add', '-b', 'agent/test-active-worktree-cleanup', agentWorktreePath, 'dev'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(agentWorktreePath, 'active-worktree-cleanup.txt'), 'cleanup from active worktree\n', 'utf8');
  result = runCmd(
    'git',
    ['add', 'active-worktree-cleanup.txt'],
    agentWorktreePath,
  );
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '--no-verify', '-m', 'active worktree cleanup change'], agentWorktreePath);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', '-u', 'origin', 'agent/test-active-worktree-cleanup'], agentWorktreePath);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/active-cleanup"
    exit 0
  fi
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  const finish = runBranchFinish(
    ['--branch', 'agent/test-active-worktree-cleanup', '--base', 'dev', '--mode', 'pr', '--cleanup'],
    agentWorktreePath,
    { GUARDEX_GH_BIN: fakeGhPath },
  );
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-active-worktree-cleanup' into 'dev' via pr flow and cleaned source branch\/worktree\./,
  );
  assert.match(finish.stderr, /Current worktree '.+' still exists because it is the active shell cwd/);

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-active-worktree-cleanup'], repoDir);
  assert.notEqual(result.status, 0, 'agent branch should be deleted locally');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-active-worktree-cleanup'], repoDir);
  assert.equal(result.stdout.trim(), '', 'agent branch should be deleted on origin');
  assert.equal(fs.existsSync(agentWorktreePath), true, 'active cwd worktree should remain until manual prune');
  result = runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], agentWorktreePath);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), 'HEAD', 'active worktree should detach before local branch deletion');
});


test('agent-branch-finish waits for required checks in PR mode and merges when ready', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-pr-wait-merge'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'agent-pr-wait.txt', 'agent wait merge\n', 'agent wait merge change');

  const ghMergeState = path.join(repoDir, '.finish-gh-merge-attempts');
  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/2"
    exit 0
  fi
  if [[ " $* " == *" --json state,mergedAt,url "* ]]; then
    attempts=0
    if [[ -f "${'${GUARDEX_TEST_GH_MERGE_STATE}'}" ]]; then
      attempts="$(cat "${'${GUARDEX_TEST_GH_MERGE_STATE}'}")"
    fi
    if [[ "$attempts" -ge 2 ]]; then
      echo -e "MERGED\\x1f2026-04-12T00:00:00Z\\x1fhttps://example.test/pr/2"
    else
      echo -e "OPEN\\x1f\\x1fhttps://example.test/pr/2"
    fi
    exit 0
  fi
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  attempts=0
  if [[ -f "${'${GUARDEX_TEST_GH_MERGE_STATE}'}" ]]; then
    attempts="$(cat "${'${GUARDEX_TEST_GH_MERGE_STATE}'}")"
  fi
  attempts=$((attempts + 1))
  echo "$attempts" > "${'${GUARDEX_TEST_GH_MERGE_STATE}'}"
  if [[ "$attempts" -lt 2 ]]; then
    echo "Required status check \\"test (node 22)\\" is expected." >&2
    exit 1
  fi
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  const finish = runBranchFinish(
    [
      '--branch',
      'agent/test-pr-wait-merge',
      '--mode',
      'pr',
      '--cleanup',
      '--wait-for-merge',
      '--wait-timeout-seconds',
      '60',
      '--wait-poll-seconds',
      '0',
    ],
    repoDir,
    {
      GUARDEX_GH_BIN: fakeGhPath,
      GUARDEX_TEST_GH_MERGE_STATE: ghMergeState,
    },
  );
  assert.equal(finish.status, 0, finish.stderr || finish.stdout);
  assert.equal(fs.readFileSync(ghMergeState, 'utf8').trim(), '2', 'finish flow should retry merge until checks are ready');
  assert.match(
    finish.stdout,
    /Merged 'agent\/test-pr-wait-merge' into 'dev' via pr flow and cleaned source branch\/worktree\./,
  );

  result = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-pr-wait-merge'], repoDir);
  assert.notEqual(result.status, 0, 'agent branch should be deleted locally after wait+merge cleanup');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-pr-wait-merge'], repoDir);
  assert.equal(result.stdout.trim(), '', 'agent branch should be deleted on origin after wait+merge cleanup');
});


test('cleanup command removes merged agent branch/worktree and remote ref', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__cleanup-branch');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-cleanup', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['-C', worktreePath, 'push', '-u', 'origin', 'agent/test-cleanup'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['cleanup', '--target', repoDir, '--branch', 'agent/test-cleanup'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const localBranch = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-cleanup'], repoDir);
  assert.notEqual(localBranch.status, 0, 'cleanup should remove local branch');
  const remoteBranch = runCmd('git', ['ls-remote', '--heads', 'origin', 'agent/test-cleanup'], repoDir);
  assert.equal(remoteBranch.stdout.trim(), '', 'cleanup should remove remote branch');
  assert.equal(fs.existsSync(worktreePath), false, 'cleanup should remove worktree');
});


test('cleanup command keeps unmerged agent branch refs but removes clean agent worktrees', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__cleanup-keep-branch');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-cleanup-keep-branch', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(worktreePath, 'feature.txt'), 'feature branch commit\n', 'utf8');
  result = runCmd('git', ['-C', worktreePath, 'add', 'feature.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['-C', worktreePath, 'commit', '-m', 'feature commit'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['cleanup', '--target', repoDir, '--branch', 'agent/test-cleanup-keep-branch', '--keep-remote'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), false, 'cleanup should remove clean worktree by default');

  const localBranch = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-cleanup-keep-branch'], repoDir);
  assert.equal(localBranch.status, 0, 'cleanup should keep unmerged local branch');
});


test('cleanup command can remove squash-merged agent branches via merged PR detection', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__cleanup-pr-merged');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-cleanup-pr-merged', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(worktreePath, 'feature.txt'), 'feature branch commit\n', 'utf8');
  result = runCmd('git', ['-C', worktreePath, 'add', 'feature.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['-C', worktreePath, 'commit', '-m', 'feature commit'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const { fakePath: fakeGhPath } = createFakeGhScript(
    'if [[ "$1" == "pr" && "$2" == "list" ]]; then\n' +
      '  printf \'%s\\n\' "agent/test-cleanup-pr-merged"\n' +
      '  exit 0\n' +
      'fi\n' +
      'exit 1',
  );

  result = runNodeWithEnv(
    [
      'cleanup',
      '--target',
      repoDir,
      '--branch',
      'agent/test-cleanup-pr-merged',
      '--keep-remote',
      '--keep-clean-worktrees',
      '--include-pr-merged',
    ],
    repoDir,
    { GUARDEX_GH_BIN: fakeGhPath },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const localBranch = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-cleanup-pr-merged'], repoDir);
  assert.notEqual(localBranch.status, 0, 'cleanup should remove merged PR local branch');
  assert.equal(fs.existsSync(worktreePath), false, 'cleanup should remove merged PR worktree');
});


test('cleanup command watch mode defaults to 60-minute idle threshold and supports one-cycle execution', () => {
  const repoDir = initRepo();
  const resultSetup = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(resultSetup.status, 0, resultSetup.stderr || resultSetup.stdout);
  seedCommit(repoDir);

  const result = runNode(['cleanup', '--target', repoDir, '--watch', '--once', '--interval', '15'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Cleanup watch cycle=1 \(interval=15s, idleMinutes=60, maxBranches=unbounded\)\./);
});

});
