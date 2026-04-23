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

const toolchainSourcePath = path.resolve(__dirname, '..', 'src', 'toolchain', 'index.js');

defineSpawnSuite('status and update integration suite', () => {

test('default invocation runs non-mutating status output', () => {
  const repoDir = initRepo();

  const result = runNode([], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[gitguardex\] CLI:/);
  assert.match(result.stdout, /\[gitguardex\] Global services:/);
  assert.match(result.stdout, /\[gitguardex\] Repo safety service:/);
  assert.match(result.stdout, /●/);
  const serviceIdx = result.stdout.indexOf('[gitguardex] Repo safety service:');
  const repoIdx = result.stdout.indexOf('[gitguardex] Repo:');
  const branchIdx = result.stdout.indexOf('[gitguardex] Branch:');
  const toolsIdx = result.stdout.indexOf('gitguardex-tools logs:');
  assert.equal(serviceIdx >= 0, true);
  assert.equal(repoIdx > serviceIdx, true);
  assert.equal(branchIdx > repoIdx, true);
  assert.equal(toolsIdx > branchIdx, true);
  assert.match(result.stdout, /gitguardex-tools logs:/);
  assert.match(result.stdout, /USAGE\n\s+\$ gx <command> \[options\]/);
  assert.match(result.stdout, /COMMANDS\n\s+status\s+Show GitGuardex CLI \+ service health without modifying files/);
  assert.match(
    result.stdout,
    /AGENT BOT\n\s+agents\s+Start\/stop review \+ cleanup bots for this repo/,
  );
  assert.match(
    result.stdout,
    /REPO TOGGLE\n\s+Set repo-root \.env: GUARDEX_ON=0 disables Guardex, GUARDEX_ON=1 enables it again/,
  );
  assert.equal(fs.existsSync(path.join(repoDir, '.githooks', 'pre-commit')), false);
});


test('status prints GitHub CLI service with friendly label', () => {
  const repoDir = initRepo();
  const fakeGh = createFakeGhScript(`
if [[ "$1" == "--version" ]]; then
  echo "gh version 9.9.9"
  exit 0
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv([], repoDir, {
    GUARDEX_GH_BIN: fakeGh.fakePath,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /GitHub \(gh\): active/);
});


test('warning-only degraded status avoids zero-error wording and points humans at doctor', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['config', 'core.hooksPath', '.bad-hooks'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['status', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Repo safety service: .*degraded \(\d+ warning\(s\)\)\./);
  assert.doesNotMatch(result.stdout, /0 error\(s\),/);
  assert.match(
    result.stdout,
    /Quick fix: run 'gx doctor' to repair drift, or review warning details with 'gx scan'\./,
  );
});


test('default invocation on degraded repo stays status-only in non-interactive mode', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['config', 'core.hooksPath', '.bad-hooks'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode([], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    /Quick fix: run 'gx doctor' to repair drift, or review warning details with 'gx scan'\./,
  );
  assert.doesNotMatch(result.stdout, /Auto-repair: repo safety is degraded/);

  const hooksPath = runCmd('git', ['config', 'core.hooksPath'], repoDir);
  assert.equal(hooksPath.status, 0, hooksPath.stderr || hooksPath.stdout);
  assert.equal(hooksPath.stdout.trim(), '.bad-hooks');
});


test('default invocation can auto-run doctor when GUARDEX_AUTO_DOCTOR=yes', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['config', 'core.hooksPath', '.bad-hooks'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNodeWithEnv([], repoDir, {
    GUARDEX_AUTO_DOCTOR: 'yes',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Auto-repair: repo safety is degraded\. Running 'gx doctor' now\./);
  assert.match(result.stdout, /Doctor\/fix:/);
  assert.match(result.stdout, /Repo is fully safe\./);

  const hooksPath = runCmd('git', ['config', 'core.hooksPath'], repoDir);
  assert.equal(hooksPath.status, 0, hooksPath.stderr || hooksPath.stdout);
  assert.equal(hooksPath.stdout.trim(), '.githooks');
});


test('default invocation outside git repo reports inactive repo service', () => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-non-repo-'));

  const result = runNode([], outsideDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[gitguardex\] CLI:/);
  assert.match(result.stdout, /\[gitguardex\] Global services:/);
  assert.match(result.stdout, /Repo safety service: .*inactive/);
});


test('default invocation checks for update and can auto-approve latest install', () => {
  const repoDir = initRepo();
  const markerPath = path.join(repoDir, '.self-update-called');
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "view" ]]; then
  echo '"9.9.9"'
  exit 0
fi
if [[ "$1" == "list" ]]; then
  echo '{"dependencies":{"oh-my-codex":{},"@fission-ai/openspec":{}}}'
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" && "$3" == "@imdeadpool/guardex@latest" ]]; then
  echo "updated" > "${markerPath}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv([], repoDir, {
    GUARDEX_NPM_BIN: fakeNpm,
    GUARDEX_FORCE_UPDATE_CHECK: '1',
    GUARDEX_AUTO_UPDATE_APPROVAL: 'yes',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /UPDATE AVAILABLE/);
  assert.match(result.stdout, new RegExp(`Current:\\s+${escapeRegexLiteral(cliVersion)}`));
  assert.match(result.stdout, /Latest\s+:\s+9\.9\.9/);
  assert.match(result.stdout, /Updated to latest published version/);
  assert.equal(fs.existsSync(markerPath), true, 'expected self-update command to run');
});


test('self-update verifies on-disk version after @latest install and retries with pinned version when stale', () => {
  const repoDir = initRepo();
  const fakeGlobalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-global-root-'));
  const installedPkgDir = path.join(fakeGlobalRoot, '@imdeadpool', 'guardex');
  fs.mkdirSync(installedPkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(installedPkgDir, 'package.json'),
    JSON.stringify({ name: '@imdeadpool/guardex', version: cliVersion }),
    'utf8',
  );
  const markerLatest = path.join(repoDir, '.npm-at-latest-called');
  const markerPinned = path.join(repoDir, '.npm-at-pinned-called');
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "view" ]]; then
  echo '"9.9.9"'
  exit 0
fi
if [[ "$1" == "list" ]]; then
  echo '{"dependencies":{"oh-my-codex":{},"@fission-ai/openspec":{}}}'
  exit 0
fi
if [[ "$1" == "root" && "$2" == "-g" ]]; then
  echo "${fakeGlobalRoot}"
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" && "$3" == "@imdeadpool/guardex@latest" ]]; then
  touch "${markerLatest}"
  # Simulate the npm quirk: report success without rewriting the on-disk package.json.
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" && "$3" == "@imdeadpool/guardex@9.9.9" ]]; then
  touch "${markerPinned}"
  # Pinned retry actually advances the on-disk version.
  printf '%s' '{"name":"@imdeadpool/guardex","version":"9.9.9"}' > "${installedPkgDir}/package.json"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv([], repoDir, {
    GUARDEX_NPM_BIN: fakeNpm,
    GUARDEX_FORCE_UPDATE_CHECK: '1',
    GUARDEX_AUTO_UPDATE_APPROVAL: 'yes',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /UPDATE AVAILABLE/);
  assert.match(result.stdout, new RegExp(`Installed version is still ${escapeRegexLiteral(cliVersion)}`));
  assert.match(result.stdout, /Retrying with pinned version 9\.9\.9/);
  assert.match(result.stdout, /Updated to latest published version/);
  assert.equal(fs.existsSync(markerLatest), true, 'expected @latest install to be attempted');
  assert.equal(fs.existsSync(markerPinned), true, 'expected pinned retry to run when stale');
});


test('self-update restarts into the installed CLI after a successful on-disk upgrade', () => {
  const repoDir = initRepo();
  const fakeGlobalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-global-root-'));
  const installedPkgDir = path.join(fakeGlobalRoot, '@imdeadpool', 'guardex');
  const installedBinDir = path.join(installedPkgDir, 'bin');
  const reexecMarker = path.join(repoDir, '.self-update-reexec-called');
  fs.mkdirSync(installedBinDir, { recursive: true });
  fs.writeFileSync(
    path.join(installedPkgDir, 'package.json'),
    JSON.stringify({
      name: '@imdeadpool/guardex',
      version: '9.9.9',
      bin: { gx: 'bin/multiagent-safety.js' },
    }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(installedBinDir, 'multiagent-safety.js'),
    '#!/usr/bin/env node\n' +
      'require("node:fs").writeFileSync(process.argv[process.argv.length - 1], "reexec\\n", "utf8");\n' +
      'console.log("REEXECED 9.9.9");\n',
    'utf8',
  );
  fs.chmodSync(path.join(installedBinDir, 'multiagent-safety.js'), 0o755);

  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "view" ]]; then
  echo '"9.9.9"'
  exit 0
fi
if [[ "$1" == "list" ]]; then
  echo '{"dependencies":{"oh-my-codex":{},"@fission-ai/openspec":{}}}'
  exit 0
fi
if [[ "$1" == "root" && "$2" == "-g" ]]; then
  echo "${fakeGlobalRoot}"
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" && "$3" == "@imdeadpool/guardex@latest" ]]; then
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(['version', reexecMarker], repoDir, {
    GUARDEX_NPM_BIN: fakeNpm,
    GUARDEX_FORCE_UPDATE_CHECK: '1',
    GUARDEX_AUTO_UPDATE_APPROVAL: 'yes',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Updated to latest published version/);
  assert.match(result.stdout, /Restarting into 9\.9\.9/);
  assert.match(result.stdout, /REEXECED 9\.9\.9/);
  assert.equal(fs.readFileSync(reexecMarker, 'utf8').trim(), 'reexec');
});


test('self-update prompt requires explicit y/n when approval is not preconfigured', () => {
  const source = fs.readFileSync(toolchainSourcePath, 'utf8');
  assert.match(
    source,
    /const shouldUpdate = interactive\s*\?\s*promptYesNoStrict\(\s*`Update now\?\s*\(\$\{NPM_BIN\} i -g \$\{packageJson\.name\}@latest\)`\s*,?\s*\)\s*:\s*autoApproval;/s,
  );
});


test('default invocation checks for openspec package updates and runs openspec update', () => {
  const repoDir = initRepo();
  const npmMarkerPath = path.join(repoDir, '.openspec-npm-update-called');
  const toolMarkerPath = path.join(repoDir, '.openspec-tool-update-called');
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" && "$2" == "-g" ]]; then
  echo '{"dependencies":{"@fission-ai/openspec":{"version":"1.2.0"}}}'
  exit 0
fi
if [[ "$1" == "view" && "$2" == "@fission-ai/openspec" && "$3" == "version" ]]; then
  echo '"1.3.0"'
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" && "$3" == "@fission-ai/openspec@latest" ]]; then
  echo "updated" > "${npmMarkerPath}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);
  const fakeOpenSpec = createFakeOpenSpecScript(`
if [[ "$1" == "update" ]]; then
  echo "updated" > "${toolMarkerPath}"
  exit 0
fi
echo "unexpected openspec args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv([], repoDir, {
    GUARDEX_NPM_BIN: fakeNpm,
    GUARDEX_OPENSPEC_BIN: fakeOpenSpec,
    GUARDEX_SKIP_UPDATE_CHECK: '1',
    GUARDEX_FORCE_OPENSPEC_UPDATE_CHECK: '1',
    GUARDEX_AUTO_OPENSPEC_UPDATE_APPROVAL: 'yes',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OPENSPEC UPDATE AVAILABLE/);
  assert.match(result.stdout, /Current:\s+1\.2\.0/);
  assert.match(result.stdout, /Latest\s+:\s+1\.3\.0/);
  assert.match(result.stdout, /OpenSpec updated to latest package and tool plugins refreshed/);
  assert.equal(fs.existsSync(npmMarkerPath), true, 'expected openspec npm install to run');
  assert.equal(fs.existsSync(toolMarkerPath), true, 'expected openspec update command to run');
});


test('openspec update prompt requires explicit y/n when approval is not preconfigured', () => {
  const source = fs.readFileSync(toolchainSourcePath, 'utf8');
  assert.match(
    source,
    /const shouldUpdate = interactive\s*\?\s*promptYesNoStrict\(\s*`Update OpenSpec now\?\s*\(\$\{NPM_BIN\} i -g \$\{OPENSPEC_PACKAGE\}@latest && \$\{OPENSPEC_BIN\} update\)`\s*,?\s*\)\s*:\s*autoApproval;/s,
  );
});


test('status --json returns cli, services, and repo summary', () => {
  const repoDir = initRepo();

  const result = runNode(['status', '--target', repoDir, '--json'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.cli.name, '@imdeadpool/guardex');
  assert.equal(typeof parsed.cli.version, 'string');
  assert.equal(Array.isArray(parsed.services), true);
  const claudeService = parsed.services.find((service) => service.name === 'oh-my-claudecode');
  assert.ok(claudeService, 'oh-my-claudecode service should be included');
  assert.equal(claudeService.packageName, 'oh-my-claude-sisyphus');
  assert.equal(
    claudeService.dependencyUrl,
    'https://github.com/Yeachan-Heo/oh-my-claudecode',
  );
  assert.ok(parsed.services.some((service) => service.name === 'cavemem'));
  assert.ok(parsed.services.some((service) => service.name === 'cavekit'));
  assert.ok(parsed.services.some((service) => service.name === 'caveman'));
  assert.equal(parsed.repo.inGitRepo, true);
  assert.equal(typeof parsed.repo.serviceStatus, 'string');
  assert.equal(parsed.repo.scan.repoRoot, repoDir);
});


test('status warns when oh-my-claudecode dependency is inactive', () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-status-target-'));
  const fakeHome = createGuardexCompanionHome({ cavekit: true, caveman: true });
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" ]]; then
  cat <<'JSON'
{"dependencies":{"oh-my-codex":{"version":"1.0.0"},"@fission-ai/openspec":{"version":"1.0.0"},"cavemem":{"version":"1.0.0"},"@imdeadpool/codex-account-switcher":{"version":"1.0.0"}}}
JSON
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(['status', '--target', targetDir], targetDir, {
    GUARDEX_NPM_BIN: fakeNpm,
    GUARDEX_HOME_DIR: fakeHome,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /oh-my-claudecode: inactive/);
  assert.match(
    result.stdout,
    /Guardex needs oh-my-claudecode as a dependency: https:\/\/github\.com\/Yeachan-Heo\/oh-my-claudecode/,
  );
});


test('status detects local cavekit and caveman companion installs', () => {
  const repoDir = initRepo();
  const fakeHome = createGuardexCompanionHome({ cavekit: true, caveman: true });
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" ]]; then
  cat <<'JSON'
{"dependencies":{"oh-my-codex":{"version":"1.0.0"},"oh-my-claude-sisyphus":{"version":"1.0.0"},"@fission-ai/openspec":{"version":"1.0.0"},"cavemem":{"version":"1.0.0"},"@imdeadpool/codex-account-switcher":{"version":"1.0.0"}}}
JSON
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(['status', '--target', repoDir, '--json'], repoDir, {
    GUARDEX_HOME_DIR: fakeHome,
    GUARDEX_NPM_BIN: fakeNpm,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.services.find((service) => service.name === 'cavekit')?.status, 'active');
  assert.equal(parsed.services.find((service) => service.name === 'caveman')?.status, 'active');
});


test('status reports gh dependency as inactive when gh is unavailable', () => {
  const repoDir = initRepo();
  const result = runNodeWithEnv(['status', '--target', repoDir, '--json'], repoDir, {
    GUARDEX_GH_BIN: 'gh-command-not-found-for-test',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  const ghService = payload.services.find((service) => service.name === 'gh');
  assert.ok(ghService, 'gh service should be included in status payload');
  assert.equal(ghService.status, 'inactive');
});


test('unknown command suggests nearest valid command', () => {
  const repoDir = initRepo();
  const result = runNode(['relese'], repoDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Did you mean 'release'\?/);
});
});
