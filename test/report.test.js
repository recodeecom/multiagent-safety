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

defineSpawnSuite('report integration suite', () => {

test('report scorecard creates baseline + remediation reports', () => {
  const repoDir = initRepo();
  const fakeScorecard = createFakeScorecardScript(`
if [[ "$1" == "--repo" && "$3" == "--format" && "$4" == "json" ]]; then
  cat <<'JSON'
{"repo":{"name":"github.com/recodeecom/multiagent-safety"},"score":5.8,"date":"2026-04-10T08:48:47Z","scorecard":{"version":"v5.0.0"},"checks":[{"name":"Dangerous-Workflow","score":10},{"name":"Code-Review","score":0},{"name":"Branch-Protection","score":3}]}
JSON
  exit 0
fi
echo "unexpected scorecard args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(
    ['report', 'scorecard', '--target', repoDir, '--repo', 'github.com/recodeecom/multiagent-safety', '--date', '2026-04-10'],
    repoDir,
    { GUARDEX_SCORECARD_BIN: fakeScorecard },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generated reports:/);

  const baselinePath = path.join(repoDir, 'docs', 'reports', 'openssf-scorecard-baseline-2026-04-10.md');
  const remediationPath = path.join(repoDir, 'docs', 'reports', 'openssf-scorecard-remediation-plan-2026-04-10.md');
  assert.equal(fs.existsSync(baselinePath), true);
  assert.equal(fs.existsSync(remediationPath), true);

  const baseline = fs.readFileSync(baselinePath, 'utf8');
  assert.match(baseline, /(\*\*)?Overall score:(\*\*)?\s+\*\*5\.8 \/ 10\*\*/);
  assert.match(baseline, /\| Code-Review \| 0 \| High \|/);

  const remediation = fs.readFileSync(remediationPath, 'utf8');
  assert.match(remediation, /\| Branch-Protection \| 3 \| High \|/);
  assert.match(remediation, /Verification loop/);
});

test('report session-severity prints the weighted rubric summary', () => {
  const repoDir = initRepo();
  const result = runNode([
    'report',
    'session-severity',
    '--task-size',
    'narrow-patch',
    '--tokens',
    '3850000',
    '--exec-count',
    '18',
    '--write-stdin-count',
    '6',
    '--completion-before-tail',
    'yes',
    '--fragmentation',
    '14',
    '--finish-path',
    '6',
    '--post-proof',
    '4',
  ], repoDir);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Score 44\/100 — Inefficient\./);
  assert.match(result.stdout, /Primary: turn fragmentation\./);
  assert.match(result.stdout, /Secondaries: write_stdin churn, cost vs expected scope, finish-path discipline, post-proof drift\./);
  assert.match(result.stdout, /A\. Cost vs expected scope: 10/);
  assert.match(result.stdout, /Total: 44/);
});

test('report session-severity emits structured JSON when requested', () => {
  const repoDir = initRepo();
  const result = runNode([
    'report',
    'session-severity',
    '--task-size',
    'medium-change',
    '--tokens',
    '2100000',
    '--exec-count',
    '12',
    '--write-stdin-count',
    '4',
    '--completion-before-tail',
    'no',
    '--fragmentation',
    '10',
    '--finish-path',
    '10',
    '--post-proof',
    '10',
    '--json',
  ], repoDir);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.taskSize, 'medium-change');
  assert.equal(payload.scores.total, 40);
  assert.equal(payload.label, 'Inefficient');
  assert.equal(payload.primaryDriver, 'turn fragmentation');
});

});
