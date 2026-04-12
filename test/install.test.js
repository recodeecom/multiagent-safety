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
  const sanitizedEnv = { ...process.env };
  delete sanitizedEnv.CODEX_THREAD_ID;
  delete sanitizedEnv.OMX_SESSION_ID;
  delete sanitizedEnv.CODEX_CI;

  return cp.spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...sanitizedEnv, ...(options.env || options) },
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

function createFakeCodexAuthScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-codex-auth-'));
  const fakePath = path.join(fakeBin, 'codex-auth');
  fs.writeFileSync(fakePath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakePath, 0o755);
  return { fakeBin, fakePath };
}

function createFakeGhScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-gh-'));
  const fakePath = path.join(fakeBin, 'gh');
  fs.writeFileSync(fakePath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakePath, 0o755);
  return { fakeBin, fakePath };
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
  return attachOriginRemoteForBranch(repoDir, 'dev');
}

function attachOriginRemoteForBranch(repoDir, branchName) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-origin-'));
  const originPath = path.join(tempDir, 'origin.git');

  let result = runCmd('git', ['init', '--bare', originPath], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['remote', 'add', 'origin', originPath], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['push', '-u', 'origin', branchName], repoDir);
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

function extractCreatedBranch(output) {
  const match = String(output || '').match(/\[agent-branch-start\] Created branch: (.+)/);
  assert.ok(match, `missing created branch in output: ${output}`);
  return match[1].trim();
}

function extractCreatedWorktree(output) {
  const match = String(output || '').match(/\[agent-branch-start\] Worktree: (.+)/);
  assert.ok(match, `missing worktree path in output: ${output}`);
  return match[1].trim();
}

test('setup provisions workflow files and repo config', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const requiredFiles = [
    'scripts/agent-branch-start.sh',
    'scripts/agent-branch-finish.sh',
    'scripts/codex-agent.sh',
    'scripts/agent-worktree-prune.sh',
    'scripts/agent-file-locks.py',
    'scripts/install-agent-git-hooks.sh',
    'scripts/openspec/init-plan-workspace.sh',
    '.githooks/pre-commit',
    '.codex/skills/guardex/SKILL.md',
    '.claude/commands/guardex.md',
    '.omx/state/agent-file-locks.json',
    '.gitignore',
    'AGENTS.md',
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(repoDir, relativePath)), true, `${relativePath} missing`);
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['agent:codex'], 'bash ./scripts/codex-agent.sh');
  assert.equal(packageJson.scripts['agent:branch:start'], 'bash ./scripts/agent-branch-start.sh');
  assert.equal(packageJson.scripts['agent:plan:init'], 'bash ./scripts/openspec/init-plan-workspace.sh');
  assert.equal(packageJson.scripts['agent:protect:list'], 'gx protect list');
  assert.equal(packageJson.scripts['agent:branch:sync'], 'gx sync');
  assert.equal(packageJson.scripts['agent:branch:sync:check'], 'gx sync --check');
  assert.equal(packageJson.scripts['agent:safety:setup'], 'gx setup');
  assert.equal(packageJson.scripts['agent:cleanup'], 'gx cleanup');

  const agentsContent = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(agentsContent.includes('<!-- multiagent-safety:START -->'), true);
  assert.match(agentsContent, /Per-message loop is mandatory/);

  const gitignoreContent = fs.readFileSync(path.join(repoDir, '.gitignore'), 'utf8');
  assert.match(gitignoreContent, /# multiagent-safety:START/);
  assert.match(gitignoreContent, /scripts\/agent-branch-start\.sh/);
  assert.match(gitignoreContent, /scripts\/codex-agent\.sh/);
  assert.match(gitignoreContent, /scripts\/agent-file-locks\.py/);
  assert.match(gitignoreContent, /\.githooks\/pre-commit/);
  assert.match(gitignoreContent, /oh-my-codex\//);
  assert.match(gitignoreContent, /\.codex\/skills\/guardex\/SKILL\.md/);
  assert.match(gitignoreContent, /\.claude\/commands\/guardex\.md/);
  assert.match(gitignoreContent, /\.omx\/state\/agent-file-locks\.json/);
  assert.match(gitignoreContent, /# multiagent-safety:END/);

  result = runCmd('git', ['config', '--get', 'core.hooksPath'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '.githooks');

  const secondRun = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);
});

test('init aliases setup and provisions workflow files', () => {
  const repoDir = initRepo();

  const result = runNode(['init', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  assert.equal(fs.existsSync(path.join(repoDir, 'scripts', 'agent-branch-start.sh')), true);
  assert.equal(fs.existsSync(path.join(repoDir, 'scripts', 'agent-branch-finish.sh')), true);
  assert.equal(fs.existsSync(path.join(repoDir, 'AGENTS.md')), true);
});

test('setup blocks in-place maintenance writes on protected main after initialization', () => {
  const repoDir = initRepoOnBranch('main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /setup blocked on protected branch 'main'/);
  assert.match(result.stderr, /agent-branch-start\.sh/);
});

test('setup allows explicit protected-main override for in-place maintenance', () => {
  const repoDir = initRepoOnBranch('main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(
    ['setup', '--target', repoDir, '--no-global-install', '--allow-protected-base-write'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('install blocks in-place maintenance writes on protected main unless override is set', () => {
  const repoDir = initRepoOnBranch('main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['install', '--target', repoDir], repoDir);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /install blocked on protected branch 'main'/);
});

test('doctor on protected main auto-runs in a sandbox branch/worktree', () => {
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

  fs.rmSync(path.join(repoDir, 'scripts', 'agent-branch-finish.sh'));

  result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /doctor detected protected branch 'main'/);
  const createdBranch = extractCreatedBranch(result.stdout);
  const createdWorktree = extractCreatedWorktree(result.stdout);
  assert.match(createdBranch, /^agent\/gx\/.+-gx-doctor$/);
  assert.equal(fs.existsSync(path.join(createdWorktree, 'scripts', 'agent-branch-finish.sh')), true);

  const rootStatus = runCmd('git', ['status', '--short', '--untracked-files=no'], repoDir);
  assert.equal(rootStatus.status, 0, rootStatus.stderr || rootStatus.stdout);
  assert.equal(rootStatus.stdout.trim(), '', 'protected main checkout should stay clean');

  const currentBranch = runCmd('git', ['branch', '--show-current'], repoDir);
  assert.equal(currentBranch.status, 0, currentBranch.stderr || currentBranch.stdout);
  assert.equal(currentBranch.stdout.trim(), 'main');
});

test('doctor on protected main syncs repaired stale lock state back to base workspace', () => {
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

  const lockPath = path.join(repoDir, '.omx', 'state', 'agent-file-locks.json');
  fs.writeFileSync(
    lockPath,
    JSON.stringify(
      {
        locks: {
          'package.json': {
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

  const scanBefore = runNode(['scan', '--target', repoDir], repoDir);
  assert.equal(scanBefore.status, 1, scanBefore.stderr || scanBefore.stdout);
  assert.match(scanBefore.stdout, /stale-branch-lock/);

  result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /doctor detected protected branch 'main'/);
  assert.match(result.stdout, /Synced repaired lock registry back to protected branch workspace/);

  const lockState = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.deepEqual(lockState.locks, {});

  const scanAfter = runNode(['scan', '--target', repoDir], repoDir);
  assert.equal(scanAfter.status, 0, scanAfter.stderr || scanAfter.stdout);
});

test('setup pre-commit blocks codex session commits on non-agent branches by default', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['checkout', '-b', 'feature/codex-test'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(repoDir, 'notes.txt'), 'hello\n', 'utf8');
  result = runCmd('git', ['add', 'notes.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['commit', '-m', 'codex non-agent commit'], repoDir, { CODEX_THREAD_ID: 'test-thread' });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /\[codex-branch-guard\] Codex agent commit blocked on non-agent branch\./);
});

test('setup pre-commit detects codex commit attempts on protected main and requires GuardeX sub-branch', () => {
  const repoDir = initRepoOnBranch('main');

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(repoDir, 'notes-main.txt'), 'hello from main\n', 'utf8');
  result = runCmd('git', ['add', 'notes-main.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['commit', '-m', 'codex protected commit'], repoDir, { CODEX_THREAD_ID: 'test-thread' });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /\[guardex-preedit-guard\] Codex edit\/commit detected on a protected branch\./);
  assert.match(result.stderr, /bash scripts\/codex-agent\.sh/);
});

test('setup pre-commit allows codex managed guardrail commits on protected main only for AGENTS.md/.gitignore', () => {
  const repoDir = initRepoOnBranch('main');

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.appendFileSync(path.join(repoDir, 'AGENTS.md'), '\n<!-- codex-managed test -->\n', 'utf8');
  result = runCmd('git', ['add', 'AGENTS.md'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'codex protected AGENTS commit'], repoDir, { CODEX_THREAD_ID: 'test-thread' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.appendFileSync(path.join(repoDir, '.gitignore'), '\n# codex-managed test\n', 'utf8');
  result = runCmd('git', ['add', '.gitignore'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'codex protected gitignore commit'], repoDir, { CODEX_THREAD_ID: 'test-thread' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(repoDir, 'notes-main.txt'), 'hello from main\n', 'utf8');
  result = runCmd('git', ['add', 'notes-main.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'codex protected non-managed commit'], repoDir, { CODEX_THREAD_ID: 'test-thread' });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /\[guardex-preedit-guard\] Codex edit\/commit detected on a protected branch\./);
});

test('setup agent-branch-start requires --allow-in-place when using --in-place', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  seedCommit(repoDir);

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'demo', 'bot', 'dev', '--in-place'], repoDir);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /--in-place is blocked by default/);
  assert.match(result.stderr, /--in-place --allow-in-place/);
});

test('setup agent-branch-start includes active codex snapshot slug in branch name', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const { fakeBin } = createFakeCodexAuthScript(`
if [[ "$1" != "list" ]]; then
  exit 1
fi
cat <<'OUT'
  default
* Zeus Edix Hu
OUT
`);

  result = runCmd(
    'bash',
    ['scripts/agent-branch-start.sh', 'restore-snapshot', 'planner', 'dev'],
    repoDir,
    { env: { PATH: `${fakeBin}:${process.env.PATH || ''}` } },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Created branch: agent\/planner\/zeus-edix-hu-restore-snapshot(?:-\d+)?/);
});

test('setup agent-branch-start supports explicit snapshot override without codex-auth', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  result = runCmd(
    'bash',
    ['scripts/agent-branch-start.sh', 'ship-fix', 'bot', 'dev'],
    repoDir,
    { env: { MUSAFETY_CODEX_AUTH_SNAPSHOT: 'Prod Snapshot One' } },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Created branch: agent\/bot\/prod-snapshot-one-ship-fix(?:-\d+)?/);
});

test('setup agent-branch-start defaults base to current branch and stores per-branch base metadata', () => {
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

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'auto-base', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentBranch = extractCreatedBranch(result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);

  const upstream = runCmd('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], agentWorktree);
  assert.equal(upstream.status, 0, upstream.stderr || upstream.stdout);
  assert.equal(upstream.stdout.trim(), 'origin/main');

  const storedBase = runCmd('git', ['config', '--get', `branch.${agentBranch}.musafetyBase`], repoDir);
  assert.equal(storedBase.status, 0, storedBase.stderr || storedBase.stdout);
  assert.equal(storedBase.stdout.trim(), 'main');
});

test('agent-branch-start moves protected-branch local changes into the new agent worktree', () => {
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

  const packageJsonPath = path.join(repoDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.name = 'demo-edited';
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(repoDir, 'scratch-note.txt'), 'untracked change\n', 'utf8');

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'move-readme', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);
  assert.match(result.stdout, /Moved local changes from 'main' into 'agent\/bot\//);

  const rootStatus = runCmd('git', ['status', '--short', '--untracked-files=no'], repoDir);
  assert.equal(rootStatus.status, 0, rootStatus.stderr || rootStatus.stdout);
  assert.equal(rootStatus.stdout.trim(), '', 'base branch checkout should be clean after auto-transfer');

  assert.match(fs.readFileSync(path.join(agentWorktree, 'package.json'), 'utf8'), /"name": "demo-edited"/);
  assert.equal(fs.existsSync(path.join(agentWorktree, 'scratch-note.txt')), true, 'untracked file should move');

  const stashList = runCmd('git', ['stash', 'list'], repoDir);
  assert.equal(stashList.status, 0, stashList.stderr || stashList.stdout);
  assert.doesNotMatch(stashList.stdout, /musafety-auto-transfer-/);
});

test('agent-branch-finish infers base from source branch metadata and updates main worktree', () => {
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

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'finish-from-dev', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentBranch = extractCreatedBranch(result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);

  commitFile(agentWorktree, 'agent-finish-main.txt', 'merged via inferred main base\n', 'agent change for main');

  result = runCmd('git', ['checkout', '-b', 'helper-finish'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const auxWorktree = path.join(path.dirname(repoDir), 'aux-main-worktree');
  result = runCmd('git', ['worktree', 'add', auxWorktree, 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const finish = runCmd('bash', ['scripts/agent-branch-finish.sh', '--branch', agentBranch], repoDir);
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

test('default invocation runs non-mutating status output', () => {
  const repoDir = initRepo();

  const result = runNode([], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[guardex\] CLI:/);
  assert.match(result.stdout, /\[guardex\] Global services:/);
  assert.match(result.stdout, /\[guardex\] Repo safety service:/);
  assert.match(result.stdout, /●/);
  const serviceIdx = result.stdout.indexOf('[guardex] Repo safety service:');
  const repoIdx = result.stdout.indexOf('[guardex] Repo:');
  const branchIdx = result.stdout.indexOf('[guardex] Branch:');
  const toolsIdx = result.stdout.indexOf('guardex-tools logs:');
  assert.equal(serviceIdx >= 0, true);
  assert.equal(repoIdx > serviceIdx, true);
  assert.equal(branchIdx > repoIdx, true);
  assert.equal(toolsIdx > branchIdx, true);
  assert.match(result.stdout, /guardex-tools logs:/);
  assert.match(result.stdout, /USAGE\n\s+\$ gx <command> \[options\]/);
  assert.match(result.stdout, /COMMANDS\n\s+status\s+Show GuardeX CLI \+ service health without modifying files/);
  assert.equal(fs.existsSync(path.join(repoDir, '.githooks', 'pre-commit')), false);
});

test('default invocation outside git repo reports inactive repo service', () => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-non-repo-'));

  const result = runNode([], outsideDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[guardex\] CLI:/);
  assert.match(result.stdout, /\[guardex\] Global services:/);
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

test('self-update prompt defaults to no when approval is not preconfigured', () => {
  const source = fs.readFileSync(cliPath, 'utf8');
  assert.match(
    source,
    /const shouldUpdate = interactive\s*\?\s*promptYesNo\(\s*`Update now\?\s*\(\$\{NPM_BIN\} i -g \$\{packageJson\.name\}@latest\)`\s*,\s*false,\s*\)\s*:\s*autoApproval;/s,
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

test('codex-agent launches codex inside a fresh sandbox worktree and keeps branch/worktree by default', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);
  let result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-codex-'));
  const fakeCodexPath = path.join(fakeBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${MUSAFETY_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${MUSAFETY_TEST_CODEX_ARGS}'}"\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd');
  const argsMarker = path.join(repoDir, '.codex-agent-args');
  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'launch-task', 'planner', 'dev', '--model', 'gpt-5.4-mini'],
    repoDir,
    {
      PATH: `${fakeBin}:${process.env.PATH}`,
      MUSAFETY_TEST_CODEX_CWD: cwdMarker,
      MUSAFETY_TEST_CODEX_ARGS: argsMarker,
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  assert.match(launch.stdout, /\[codex-agent\] Launching codex in sandbox:/);
  assert.match(launch.stdout, /\[codex-agent\] Session ended \(exit=0\)\. Running worktree cleanup\.\.\./);
  assert.match(launch.stdout, /\[codex-agent\] Sandbox worktree kept:/);

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.match(
    launchedCwd,
    new RegExp(`${escapeRegexLiteral(repoDir)}/\\.omx/agent-worktrees/agent__planner__`),
  );

  const launchedArgs = fs.readFileSync(argsMarker, 'utf8').trim();
  assert.match(launchedArgs, /--model gpt-5\.4-mini/);

  assert.equal(fs.existsSync(launchedCwd), true, 'clean codex-agent sandbox should stay available by default');
  const launchedBranch = extractCreatedBranch(launch.stdout);
  const branchResult = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${launchedBranch}`], repoDir);
  assert.equal(branchResult.status, 0, 'agent branch should remain after default codex-agent run');
});

test('codex-agent supports --codex-bin override before positional arguments', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);
  let result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-codex-bin-'));
  const fakeCodexPath = path.join(fakeBin, 'my-codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${MUSAFETY_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${MUSAFETY_TEST_CODEX_ARGS}'}"\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd-override');
  const argsMarker = path.join(repoDir, '.codex-agent-args-override');
  const launch = runCmd(
    'bash',
    [
      'scripts/codex-agent.sh',
      '--codex-bin',
      fakeCodexPath,
      'launch-task',
      'planner',
      'dev',
      '--model',
      'gpt-5.4-mini',
    ],
    repoDir,
    {
      MUSAFETY_TEST_CODEX_CWD: cwdMarker,
      MUSAFETY_TEST_CODEX_ARGS: argsMarker,
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  assert.match(launch.stdout, /\[codex-agent\] Launching .* in sandbox:/);
  assert.match(launch.stdout, /\[codex-agent\] Sandbox worktree kept:/);

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.match(
    launchedCwd,
    new RegExp(`${escapeRegexLiteral(repoDir)}/\\.omx/agent-worktrees/agent__planner__`),
  );
  const launchedArgs = fs.readFileSync(argsMarker, 'utf8').trim();
  assert.match(launchedArgs, /--model gpt-5\.4-mini/);
  assert.equal(fs.existsSync(launchedCwd), true, 'override invocation should keep sandbox unless cleanup is requested');
});

test('codex-agent keeps dirty sandbox worktrees after session exit', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-codex-dirty-'));
  const fakeCodexPath = path.join(fakeBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${MUSAFETY_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${MUSAFETY_TEST_CODEX_ARGS}'}"\n` +
      `echo "dirty" > codex-dirty.txt\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd-dirty');
  const argsMarker = path.join(repoDir, '.codex-agent-args-dirty');
  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'dirty-task', 'planner', 'dev', '--model', 'gpt-5.4-mini'],
    repoDir,
    {
      PATH: `${fakeBin}:${process.env.PATH}`,
      MUSAFETY_TEST_CODEX_CWD: cwdMarker,
      MUSAFETY_TEST_CODEX_ARGS: argsMarker,
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  assert.match(
    launch.stdout,
    /\[agent-worktree-prune\] Skipping dirty worktree|\[codex-agent\] Auto-committed sandbox changes on/,
  );
  assert.match(launch.stdout, /\[codex-agent\] Sandbox worktree kept:/);

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.equal(fs.existsSync(launchedCwd), true, 'dirty sandbox should be preserved');
  assert.equal(fs.existsSync(path.join(launchedCwd, 'codex-dirty.txt')), true);
});

test('codex-agent auto-finishes dirty sandbox branches via PR flow when origin is configured', () => {
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

  const fakeCodexBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-codex-autofinish-'));
  const fakeCodexPath = path.join(fakeCodexBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${MUSAFETY_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${MUSAFETY_TEST_CODEX_ARGS}'}"\n` +
      `echo "auto-finish-change" > codex-autofinish.txt\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/auto-finish"
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

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd-autofinish');
  const argsMarker = path.join(repoDir, '.codex-agent-args-autofinish');
  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'autofinish-task', 'planner', 'dev', '--model', 'gpt-5.4-mini'],
    repoDir,
    {
      PATH: `${fakeCodexBin}:${process.env.PATH}`,
      MUSAFETY_TEST_CODEX_CWD: cwdMarker,
      MUSAFETY_TEST_CODEX_ARGS: argsMarker,
      MUSAFETY_GH_BIN: fakeGhPath,
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  assert.match(launch.stdout, /\[codex-agent\] Auto-finish enabled: commit -> push\/PR -> merge \(keep branch\/worktree\)\./);
  assert.match(launch.stdout, /\[codex-agent\] Auto-finish completed for/);
  assert.match(launch.stdout, /\[codex-agent\] Sandbox worktree kept:/);

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.equal(fs.existsSync(launchedCwd), true, 'auto-finished sandbox should stay until explicit cleanup');
  const launchedBranch = extractCreatedBranch(launch.stdout);
  result = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${launchedBranch}`], repoDir);
  assert.equal(result.status, 0, 'auto-finished branch should remain locally by default');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', launchedBranch], repoDir);
  assert.match(result.stdout, /refs\/heads\//, 'auto-finished branch should remain on origin by default');

  const launchedArgs = fs.readFileSync(argsMarker, 'utf8').trim();
  assert.match(launchedArgs, /--model gpt-5\.4-mini/);
});

test('sync command rebases current agent branch onto latest origin/dev', () => {
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
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
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
  assert.match(commitAttempt.stderr, /gx sync --base dev/);
});

test('pre-commit sync gate honors maxBehindCommits threshold', () => {
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

  const finish = runCmd(
    'bash',
    ['scripts/agent-branch-finish.sh', '--branch', 'agent/test-finish-sync-guard'],
    repoDir,
  );
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

  const finish = runCmd(
    'bash',
    ['scripts/agent-branch-finish.sh', '--branch', 'agent/test-pr-delete-error', '--mode', 'pr', '--cleanup'],
    repoDir,
    { MUSAFETY_GH_BIN: fakeGhPath },
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

test('doctor repairs setup drift and confirms repo is safe', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  // Simulate broken setup + stale lock.
  fs.rmSync(path.join(repoDir, 'scripts', 'agent-branch-start.sh'));
  fs.writeFileSync(path.join(repoDir, '.githooks', 'pre-commit'), '#!/usr/bin/env bash\necho broken hook >&2\nexit 1\n', 'utf8');
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
  assert.match(result.stdout, /Repo is fully safe/);

  const repairedHook = fs.readFileSync(path.join(repoDir, '.githooks', 'pre-commit'), 'utf8');
  assert.match(repairedHook, /AGENTS\.md\|\.gitignore/);

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
  assert.match(result.stdout, /npm i -g @imdeadpool\/guardex/);
  assert.match(
    result.stdout,
    /npm i -g oh-my-codex @fission-ai\/openspec @imdeadpool\/codex-account-switcher/,
  );
  assert.match(result.stdout, /gx setup/);
  assert.match(result.stdout, /gx init/);
  assert.match(result.stdout, /Codex or Claude/);
  assert.match(result.stdout, /scripts\/agent-file-locks.py claim/);
  assert.match(result.stdout, /For every new user message\/task, repeat the same cycle/);
});

test('copy-commands outputs command-only checklist', () => {
  const repoDir = initRepo();
  const result = runNode(['copy-commands'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^npm i -g @imdeadpool\/guardex/m);
  assert.match(result.stdout, /gx setup/);
  assert.match(result.stdout, /gx doctor/);
  assert.match(result.stdout, /scripts\/agent-file-locks.py claim/);
  assert.match(result.stdout, /gx sync --check/);
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

test('setup skips global install when OMX/OpenSpec/codex-auth are already installed', () => {
  const repoDir = initRepo();
  const marker = path.join(repoDir, '.global-install-called');
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" ]]; then
  cat <<'JSON'
{"dependencies":{"oh-my-codex":{"version":"1.0.0"},"@fission-ai/openspec":{"version":"1.0.0"},"@imdeadpool/codex-account-switcher":{"version":"1.0.0"}}}
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
  assert.equal(args, 'i -g @fission-ai/openspec @imdeadpool/codex-account-switcher');
});

test('worktree prune keeps merged agent worktrees/branches unless delete flags are set', () => {
  const repoDir = initRepo();
  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__test-prune');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-prune', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(worktreePath), true);

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const branchResult = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-prune'], repoDir);
  assert.equal(branchResult.status, 0, 'merged agent branch should remain by default');

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh', '--delete-branches'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), false);
  const branchAfterDelete = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-prune'], repoDir);
  assert.notEqual(branchAfterDelete.status, 0, 'merged agent branch should be removed when delete flag is set');
});

test('worktree prune preserves dirty agent worktrees unless --force-dirty is used', () => {
  const repoDir = initRepo();
  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__test-dirty-prune');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-dirty-prune', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(worktreePath, 'dirty.txt'), 'dirty\n', 'utf8');

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh', '--delete-branches'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), true, 'dirty worktree should remain without --force-dirty');

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh', '--force-dirty', '--delete-branches'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), false, 'dirty worktree should be removable with --force-dirty');
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
