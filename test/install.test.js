const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const cliPath = path.resolve(__dirname, '..', 'bin', 'multiagent-safety.js');
const cliVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
).version;

function runNode(args, cwd) {
  return cp.spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
}

function runNodeWithEnv(args, cwd, extraEnv) {
  return cp.spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

function runCmd(cmd, args, cwd, options = {}) {
  return cp.spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || options) },
  });
}

function createFakeNpmScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-npm-'));
  const fakeNpmPath = path.join(fakeBin, 'npm');
  fs.writeFileSync(fakeNpmPath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakeNpmPath, 0o755);
  return fakeNpmPath;
}

function createFakeScorecardScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-scorecard-'));
  const fakePath = path.join(fakeBin, 'scorecard');
  fs.writeFileSync(fakePath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakePath, 0o755);
  return fakePath;
}

function initRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-'));
  const repoDir = path.join(tempDir, 'repo');
  fs.mkdirSync(repoDir);

  let result = runCmd('git', ['init', '-b', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['config', 'user.email', 'bot@example.com'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['config', 'user.name', 'Bot'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(
    path.join(repoDir, 'package.json'),
    JSON.stringify({ name: 'demo', private: true, scripts: {} }, null, 2) + '\n',
  );

  return repoDir;
}

function initRepoOnBranch(branchName) {
  const repoDir = initRepo();
  const result = runCmd('git', ['checkout', '-b', branchName], repoDir);
  if (result.status !== 0 && !result.stderr.includes('already exists')) {
    assert.equal(result.status, 0, result.stderr);
  }
  runCmd('git', ['checkout', branchName], repoDir);
  return repoDir;
}

function seedCommit(repoDir) {
  let result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'seed'], repoDir);
  assert.equal(result.status, 0, result.stderr);
}

function attachOriginRemote(repoDir) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-origin-'));
  const originPath = path.join(tempDir, 'origin.git');

  let result = runCmd('git', ['init', '--bare', originPath], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['remote', 'add', 'origin', originPath], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['push', '-u', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  return originPath;
}

function commitFile(repoDir, relativePath, contents, message) {
  const filePath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');

  const currentBranch = runCmd('git', ['branch', '--show-current'], repoDir);
  assert.equal(currentBranch.status, 0, currentBranch.stderr);
  const branchName = currentBranch.stdout.trim();
  const lockScriptPath = path.join(repoDir, 'scripts', 'agent-file-locks.py');
  if (branchName.startsWith('agent/') && fs.existsSync(lockScriptPath)) {
    const claim = runCmd(
      'python3',
      ['scripts/agent-file-locks.py', 'claim', '--branch', branchName, relativePath],
      repoDir,
    );
    assert.equal(claim.status, 0, claim.stderr || claim.stdout);
  }

  let result = runCmd('git', ['add', relativePath], repoDir);
  assert.equal(result.status, 0, result.stderr);
  const commitEnv = ['dev', 'main', 'master'].includes(branchName)
    ? { ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1' }
    : {};
  result = runCmd('git', ['commit', '-m', message], repoDir, commitEnv);
  assert.equal(result.status, 0, result.stderr);
}

function aheadBehindCounts(repoDir, branchRef, baseRef) {
  const result = runCmd('git', ['rev-list', '--left-right', '--count', `${branchRef}...${baseRef}`], repoDir);
  assert.equal(result.status, 0, result.stderr);
  const [aheadRaw, behindRaw] = result.stdout.trim().split(/\s+/);
  return {
    ahead: Number.parseInt(aheadRaw || '0', 10),
    behind: Number.parseInt(behindRaw || '0', 10),
  };
}

function escapeRegexLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('setup provisions workflow files and repo config', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const requiredFiles = [
    'scripts/agent-branch-start.sh',
    'scripts/agent-branch-finish.sh',
    'scripts/agent-worktree-prune.sh',
    'scripts/agent-file-locks.py',
    'scripts/install-agent-git-hooks.sh',
    'scripts/openspec/init-plan-workspace.sh',
    '.githooks/pre-commit',
    '.codex/skills/musafety/SKILL.md',
    '.claude/commands/musafety.md',
    '.omx/state/agent-file-locks.json',
    '.gitignore',
    'AGENTS.md',
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(repoDir, relativePath)), true, `${relativePath} missing`);
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['agent:branch:start'], 'bash ./scripts/agent-branch-start.sh');
  assert.equal(packageJson.scripts['agent:plan:init'], 'bash ./scripts/openspec/init-plan-workspace.sh');
  assert.equal(packageJson.scripts['agent:protect:list'], 'musafety protect list');
  assert.equal(packageJson.scripts['agent:branch:sync'], 'musafety sync');
  assert.equal(packageJson.scripts['agent:branch:sync:check'], 'musafety sync --check');
  assert.equal(packageJson.scripts['agent:safety:setup'], 'musafety setup');
  assert.equal(packageJson.scripts['agent:cleanup'], 'bash ./scripts/agent-worktree-prune.sh --base dev');

  const agentsContent = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(agentsContent.includes('<!-- multiagent-safety:START -->'), true);

  const gitignoreContent = fs.readFileSync(path.join(repoDir, '.gitignore'), 'utf8');
  assert.match(gitignoreContent, /# multiagent-safety:START/);
  assert.match(gitignoreContent, /scripts\/agent-branch-start\.sh/);
  assert.match(gitignoreContent, /scripts\/agent-file-locks\.py/);
  assert.match(gitignoreContent, /\.githooks\/pre-commit/);
  assert.match(gitignoreContent, /\.codex\/skills\/musafety\/SKILL\.md/);
  assert.match(gitignoreContent, /\.claude\/commands\/musafety\.md/);
  assert.match(gitignoreContent, /\.omx\/state\/agent-file-locks\.json/);
  assert.match(gitignoreContent, /# multiagent-safety:END/);

  result = runCmd('git', ['config', '--get', 'core.hooksPath'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '.githooks');

  const secondRun = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);
});

test('default invocation runs non-mutating status output', () => {
  const repoDir = initRepo();

  const result = runNode([], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[musafety\] CLI:/);
  assert.match(result.stdout, /\[musafety\] Global services:/);
  assert.match(result.stdout, /\[musafety\] Repo safety service:/);
  assert.match(result.stdout, /●/);
  const serviceIdx = result.stdout.indexOf('[musafety] Repo safety service:');
  const repoIdx = result.stdout.indexOf('[musafety] Repo:');
  const branchIdx = result.stdout.indexOf('[musafety] Branch:');
  const toolsIdx = result.stdout.indexOf('musafety-tools logs:');
  assert.equal(serviceIdx >= 0, true);
  assert.equal(repoIdx > serviceIdx, true);
  assert.equal(branchIdx > repoIdx, true);
  assert.equal(toolsIdx > branchIdx, true);
  assert.match(result.stdout, /musafety-tools logs:/);
  assert.match(result.stdout, /USAGE\n\s+\$ musafety <command> \[options\]/);
  assert.match(result.stdout, /COMMANDS\n\s+status\s+Show musafety CLI \+ service health without modifying files/);
  assert.equal(fs.existsSync(path.join(repoDir, '.githooks', 'pre-commit')), false);
});

test('default invocation outside git repo reports inactive repo service', () => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-non-repo-'));

  const result = runNode([], outsideDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[musafety\] CLI:/);
  assert.match(result.stdout, /\[musafety\] Global services:/);
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
if [[ "$1" == "i" && "$2" == "-g" && "$3" == "musafety@latest" ]]; then
  echo "updated" > "${markerPath}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv([], repoDir, {
    MUSAFETY_NPM_BIN: fakeNpm,
    MUSAFETY_FORCE_UPDATE_CHECK: '1',
    MUSAFETY_AUTO_UPDATE_APPROVAL: 'yes',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /UPDATE AVAILABLE/);
  assert.match(result.stdout, new RegExp(`Current:\\s+${escapeRegexLiteral(cliVersion)}`));
  assert.match(result.stdout, /Latest\s+:\s+9\.9\.9/);
  assert.match(result.stdout, /Updated to latest published version/);
  assert.equal(fs.existsSync(markerPath), true, 'expected self-update command to run');
});

test('status --json returns cli, services, and repo summary', () => {
  const repoDir = initRepo();

  const result = runNode(['status', '--target', repoDir, '--json'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.cli.name, 'musafety');
  assert.equal(typeof parsed.cli.version, 'string');
  assert.equal(Array.isArray(parsed.services), true);
  assert.equal(parsed.repo.inGitRepo, true);
  assert.equal(typeof parsed.repo.serviceStatus, 'string');
  assert.equal(parsed.repo.scan.repoRoot, repoDir);
});

test('setup appends managed gitignore block without clobbering existing entries', () => {
  const repoDir = initRepo();
  fs.writeFileSync(path.join(repoDir, '.gitignore'), 'node_modules/\n.DS_Store\n', 'utf8');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const first = fs.readFileSync(path.join(repoDir, '.gitignore'), 'utf8');
  assert.match(first, /node_modules\//);
  assert.match(first, /# multiagent-safety:START/);
  assert.match(first, /# multiagent-safety:END/);

  result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const second = fs.readFileSync(path.join(repoDir, '.gitignore'), 'utf8');
  const blockStarts = second.match(/# multiagent-safety:START/g) || [];
  assert.equal(blockStarts.length, 1, 'managed gitignore block should be unique');
});

test('setup --no-gitignore skips creating managed gitignore block', () => {
  const repoDir = initRepo();

  const result = runNode(['setup', '--target', repoDir, '--no-global-install', '--no-gitignore'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(repoDir, '.gitignore')), false);
});

test('protect command manages configured protected branches', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  let result = runNode(['protect', 'list', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /dev, main, master/);

  result = runNode(['protect', 'add', 'release', 'staging', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /release, staging/);

  result = runNode(['protect', 'list', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /dev, main, master, release, staging/);

  result = runNode(['protect', 'remove', 'dev', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['protect', 'list', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /main, master, release, staging/);

  result = runNode(['protect', 'reset', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /reset to defaults/);
});

test('pre-commit blocks custom protected branches configured via musafety protect', () => {
  const repoDir = initRepoOnBranch('release');
  seedCommit(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['protect', 'add', 'release', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const hookResult = runCmd('bash', ['.githooks/pre-commit'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '0',
    VSCODE_GIT_IPC_HANDLE: '1',
  });
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /Direct commits on protected branches are blocked/);
});

test('pre-commit blocks protected branch commits even from VS Code Source Control env', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const hookResult = runCmd(
    'bash',
    ['.githooks/pre-commit'],
    repoDir,
    {
      ALLOW_COMMIT_ON_PROTECTED_BRANCH: '0',
      VSCODE_GIT_IPC_HANDLE: '1',
      VSCODE_GIT_ASKPASS_NODE: '1',
      VSCODE_IPC_HOOK_CLI: '1',
    },
  );
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /Direct commits on protected branches are blocked/);
});

test('sync command rebases current agent branch onto latest origin/dev', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply musafety setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-sync'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'agent.txt', 'agent change\n', 'agent change');

  result = runCmd('git', ['checkout', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'dev.txt', 'dev change\n', 'dev change');
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', 'agent/test-sync'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const checkBefore = runNode(['sync', '--check', '--target', repoDir], repoDir);
  assert.equal(checkBefore.status, 1, checkBefore.stderr || checkBefore.stdout);
  assert.match(checkBefore.stdout, /Sync required: yes/);

  const syncResult = runNode(['sync', '--target', repoDir], repoDir);
  assert.equal(syncResult.status, 0, syncResult.stderr || syncResult.stdout);
  assert.match(syncResult.stdout, /Result: success/);

  const counts = aheadBehindCounts(repoDir, 'agent/test-sync', 'origin/dev');
  assert.equal(counts.behind, 0, 'agent branch should be fully synced with origin/dev');

  const checkAfter = runNode(['sync', '--check', '--target', repoDir, '--json'], repoDir);
  assert.equal(checkAfter.status, 0, checkAfter.stderr || checkAfter.stdout);
  const payload = JSON.parse(checkAfter.stdout);
  assert.equal(payload.behindBefore, 0);
});

test('pre-commit sync gate blocks agent commits when branch is too far behind base', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply musafety setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-behind-gate'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'dev-gate-ahead.txt', 'dev ahead for gate\n', 'dev ahead for gate');
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', 'agent/test-behind-gate'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['config', 'multiagent.sync.requireBeforeCommit', 'true'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['config', 'multiagent.sync.maxBehindCommits', '0'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(repoDir, 'agent-blocked.txt'), 'blocked\n');
  result = runCmd(
    'python3',
    ['scripts/agent-file-locks.py', 'claim', '--branch', 'agent/test-behind-gate', 'agent-blocked.txt'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', 'agent-blocked.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const commitAttempt = runCmd('git', ['commit', '-m', 'should block due to behind gate'], repoDir);
  assert.equal(commitAttempt.status, 1, commitAttempt.stderr || commitAttempt.stdout);
  assert.match(commitAttempt.stderr, /agent-sync-guard/);
  assert.match(commitAttempt.stderr, /musafety sync --base dev/);
});

test('pre-commit sync gate honors maxBehindCommits threshold', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply musafety setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', '-b', 'agent/test-behind-threshold'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  commitFile(repoDir, 'dev-threshold-ahead.txt', 'dev ahead threshold\n', 'dev ahead threshold');
  result = runCmd('git', ['push', 'origin', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['checkout', 'agent/test-behind-threshold'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['config', 'multiagent.sync.requireBeforeCommit', 'true'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['config', 'multiagent.sync.maxBehindCommits', '2'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(repoDir, 'agent-allowed.txt'), 'allowed\n');
  result = runCmd(
    'python3',
    ['scripts/agent-file-locks.py', 'claim', '--branch', 'agent/test-behind-threshold', 'agent-allowed.txt'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', 'agent-allowed.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const commitAttempt = runCmd('git', ['commit', '-m', 'allowed by behind threshold'], repoDir);
  assert.equal(commitAttempt.status, 0, commitAttempt.stderr || commitAttempt.stdout);
});

test('agent-branch-finish blocks when source branch is behind origin/dev', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply musafety setup'], repoDir, {
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

  const finish = runCmd(
    'bash',
    ['scripts/agent-branch-finish.sh', '--branch', 'agent/test-finish-sync-guard'],
    repoDir,
  );
  assert.equal(finish.status, 1, finish.stderr || finish.stdout);
  assert.match(finish.stderr, /agent-sync-guard/);
  assert.match(finish.stderr, /musafety sync --base dev/);
});

test('OpenSpec plan workspace scaffold creates expected role/task structure', () => {
  const repoDir = initRepo();

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const planSlug = 'plan-workspace-smoke';
  const scaffold = runCmd(
    'bash',
    ['scripts/openspec/init-plan-workspace.sh', planSlug],
    repoDir,
  );
  assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);

  const planDir = path.join(repoDir, 'openspec', 'plan', planSlug);
  const expected = [
    'summary.md',
    'checkpoints.md',
    'planner/plan.md',
    'planner/tasks.md',
    'architect/tasks.md',
    'critic/tasks.md',
    'executor/tasks.md',
    'writer/tasks.md',
    'verifier/tasks.md',
  ];
  for (const rel of expected) {
    assert.equal(fs.existsSync(path.join(planDir, rel)), true, `${rel} missing`);
  }

  const plannerTasks = fs.readFileSync(path.join(planDir, 'planner', 'tasks.md'), 'utf8');
  assert.match(plannerTasks, /## 1\. Spec/);
  assert.match(plannerTasks, /## 2\. Tests/);
  assert.match(plannerTasks, /## 3\. Implementation/);
  assert.match(plannerTasks, /## 4\. Checkpoints/);
});

test('validate blocks unapproved deletions until allow-delete is set', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const featureFile = path.join(repoDir, 'src', 'logic.txt');
  fs.mkdirSync(path.dirname(featureFile), { recursive: true });
  fs.writeFileSync(featureFile, 'hello\n');

  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'seed'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd(
    'python3',
    ['scripts/agent-file-locks.py', 'claim', '--branch', 'agent/test', 'src/logic.txt'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.unlinkSync(featureFile);
  result = runCmd('git', ['add', '-A'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd(
    'python3',
    ['scripts/agent-file-locks.py', 'validate', '--branch', 'agent/test', '--staged'],
    repoDir,
  );
  assert.equal(result.status, 1, 'deletion should be blocked without allow-delete');
  assert.match(result.stderr, /Delete not approved/);

  result = runCmd(
    'python3',
    ['scripts/agent-file-locks.py', 'allow-delete', '--branch', 'agent/test', 'src/logic.txt'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd(
    'python3',
    ['scripts/agent-file-locks.py', 'validate', '--branch', 'agent/test', '--staged'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('fix repairs stale lock issues so scan becomes clean', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  // Simulate broken state
  fs.rmSync(path.join(repoDir, 'scripts', 'agent-branch-start.sh'));
  result = runCmd('git', ['config', 'core.hooksPath', '.git/hooks'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const lockPath = path.join(repoDir, '.omx', 'state', 'agent-file-locks.json');
  fs.writeFileSync(
    lockPath,
    JSON.stringify(
      {
        locks: {
          'missing/file.ts': {
            branch: 'agent/non-existent',
            claimed_at: '2026-01-01T00:00:00Z',
            allow_delete: false,
          },
        },
      },
      null,
      2,
    ) + '\n',
  );

  result = runNode(['scan', '--target', repoDir], repoDir);
  assert.equal(result.status, 2, 'missing file should yield error');

  result = runNode(['fix', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['scan', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('doctor repairs setup drift and confirms repo is musafe', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  // Simulate broken setup + stale lock.
  fs.rmSync(path.join(repoDir, 'scripts', 'agent-branch-start.sh'));
  result = runCmd('git', ['config', 'core.hooksPath', '.git/hooks'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  const lockPath = path.join(repoDir, '.omx', 'state', 'agent-file-locks.json');
  fs.writeFileSync(
    lockPath,
    JSON.stringify(
      {
        locks: {
          'missing/file.ts': {
            branch: 'agent/non-existent',
            claimed_at: '2026-01-01T00:00:00Z',
            allow_delete: false,
          },
        },
      },
      null,
      2,
    ) + '\n',
  );

  result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Doctor\/fix/);
  assert.match(result.stdout, /Repo is correctly musafe/);

  const scanAfter = runNode(['scan', '--target', repoDir], repoDir);
  assert.equal(scanAfter.status, 0, scanAfter.stderr || scanAfter.stdout);
});

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
    { MUSAFETY_SCORECARD_BIN: fakeScorecard },
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

test('copy-prompt outputs AI setup instructions', () => {
  const repoDir = initRepo();
  const result = runNode(['copy-prompt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /npm i -g musafety/);
  assert.match(result.stdout, /npm i -g oh-my-codex @fission-ai\/openspec/);
  assert.match(result.stdout, /musafety setup/);
  assert.match(result.stdout, /Codex or Claude/);
  assert.match(result.stdout, /scripts\/agent-file-locks.py claim/);
});

test('copy-commands outputs command-only checklist', () => {
  const repoDir = initRepo();
  const result = runNode(['copy-commands'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^npm i -g musafety/m);
  assert.match(result.stdout, /musafety setup/);
  assert.match(result.stdout, /musafety doctor/);
  assert.match(result.stdout, /scripts\/agent-file-locks.py claim/);
  assert.match(result.stdout, /musafety sync --check/);
  assert.doesNotMatch(result.stdout, /Use this exact checklist/);
});

test('setup dry-run accepts explicit global install approval flags', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir, '--dry-run', '--yes-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Dry run setup done/);

  result = runNode(['setup', '--target', repoDir, '--dry-run', '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Dry run setup done/);
});

test('setup skips global install when OMX/OpenSpec are already installed', () => {
  const repoDir = initRepo();
  const marker = path.join(repoDir, '.global-install-called');
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" ]]; then
  cat <<'JSON'
{"dependencies":{"oh-my-codex":{"version":"1.0.0"},"@fission-ai/openspec":{"version":"1.0.0"}}}
JSON
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" ]]; then
  echo "$@" > "${marker}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(['setup', '--target', repoDir, '--yes-global-install'], repoDir, {
    MUSAFETY_NPM_BIN: fakeNpm,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Already installed globally/);
  assert.match(result.stdout, /already installed\. Skipping/);
  assert.equal(fs.existsSync(marker), false, 'global install should be skipped');
});

test('setup installs only missing global tools', () => {
  const repoDir = initRepo();
  const marker = path.join(repoDir, '.global-install-called');
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" ]]; then
  cat <<'JSON'
{"dependencies":{"oh-my-codex":{"version":"1.0.0"}}}
JSON
  exit 0
fi
if [[ "$1" == "i" && "$2" == "-g" ]]; then
  echo "$@" > "${marker}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(['setup', '--target', repoDir, '--yes-global-install'], repoDir, {
    MUSAFETY_NPM_BIN: fakeNpm,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(marker), true, 'global install should run for missing package');
  const args = fs.readFileSync(marker, 'utf8').trim();
  assert.equal(args, 'i -g @fission-ai/openspec');
});

test('worktree prune removes merged agent worktrees and branches', () => {
  const repoDir = initRepo();
  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__test-prune');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-prune', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(worktreePath), true);

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh', '--base', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), false);

  const branchResult = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-prune'], repoDir);
  assert.notEqual(branchResult.status, 0, 'merged agent branch should be removed by prune');
});

test('release fails outside the maintainer repo path', () => {
  const repoDir = initRepoOnBranch('main');
  const result = runNode(['release'], repoDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only allowed in/);
});

test('release fails when branch is not main', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  const result = runNodeWithEnv(['release'], repoDir, {
    MUSAFETY_RELEASE_REPO: repoDir,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /required: 'main'/);
});

test('release fails when git status is dirty', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  fs.writeFileSync(path.join(repoDir, 'dirty.txt'), 'dirty\n');
  const result = runNodeWithEnv(['release'], repoDir, {
    MUSAFETY_RELEASE_REPO: repoDir,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /working tree is not clean/);
});

test('release runs npm publish when guardrails pass', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-bin-'));
  const markerPath = path.join(repoDir, '.npm-publish-called');
  const fakeNpmPath = path.join(fakeBin, 'npm');
  fs.writeFileSync(
    fakeNpmPath,
    `#!/usr/bin/env bash\n` +
      `echo "$@" > "${markerPath}"\n` +
      `exit 0\n`,
    'utf8',
  );
  fs.chmodSync(fakeNpmPath, 0o755);

  const result = runNodeWithEnv(['release'], repoDir, {
    MUSAFETY_RELEASE_REPO: repoDir,
    PATH: `${fakeBin}:${process.env.PATH}`,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const args = fs.readFileSync(markerPath, 'utf8').trim();
  assert.equal(args, 'publish');
});

test('typo helper maps relaese/realaese to release', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  const marker = path.join(os.tmpdir(), `musafety-typo-publish-${Date.now()}-${Math.random()}.txt`);
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "publish" ]]; then
  echo "$@" > "${marker}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const typoA = runNodeWithEnv(['relaese'], repoDir, {
    MUSAFETY_RELEASE_REPO: repoDir,
    MUSAFETY_NPM_BIN: fakeNpm,
  });
  assert.equal(typoA.status, 0, typoA.stderr || typoA.stdout);
  assert.match(typoA.stdout, /Interpreting 'relaese' as 'release'/);
  assert.equal(fs.readFileSync(marker, 'utf8').trim(), 'publish');

  const typoB = runNodeWithEnv(['realaese'], repoDir, {
    MUSAFETY_RELEASE_REPO: repoDir,
    MUSAFETY_NPM_BIN: fakeNpm,
  });
  assert.equal(typoB.status, 0, typoB.stderr || typoB.stdout);
  assert.match(typoB.stdout, /Interpreting 'realaese' as 'release'/);
  assert.equal(fs.readFileSync(marker, 'utf8').trim(), 'publish');
});

test('unknown command suggests nearest valid command', () => {
  const repoDir = initRepo();
  const result = runNode(['relese'], repoDir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Did you mean 'release'\?/);
});
