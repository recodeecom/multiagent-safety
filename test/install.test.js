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
const withPackageJson = true;

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

  const overrideEnv = options.env || options;
  const pushBypassEnv =
    cmd === 'git' && Array.isArray(args) && args[0] === 'push'
      ? { ALLOW_PUSH_ON_PROTECTED_BRANCH: '1' }
      : {};

  return cp.spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...sanitizedEnv, ...pushBypassEnv, ...overrideEnv },
  });
}

function createFakeNpmScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-npm-'));
  const fakeNpmPath = path.join(fakeBin, 'npm');
  fs.writeFileSync(fakeNpmPath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakeNpmPath, 0o755);
  return fakeNpmPath;
}

function createFakeOpenSpecScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-openspec-'));
  const fakeOpenSpecPath = path.join(fakeBin, 'openspec');
  fs.writeFileSync(fakeOpenSpecPath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakeOpenSpecPath, 0o755);
  return fakeOpenSpecPath;
}

function createFakeScorecardScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-scorecard-'));
  const fakePath = path.join(fakeBin, 'scorecard');
  fs.writeFileSync(fakePath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakePath, 0o755);
  return fakePath;
}

function createFakeCodexAuthScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-auth-'));
  const fakePath = path.join(fakeBin, 'codex-auth');
  fs.writeFileSync(fakePath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakePath, 0o755);
  return { fakeBin, fakePath };
}

function createFakeGhScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-gh-'));
  const fakePath = path.join(fakeBin, 'gh');
  fs.writeFileSync(fakePath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakePath, 0o755);
  return { fakeBin, fakePath };
}

function initRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-'));
  const repoDir = path.join(tempDir, 'repo');
  fs.mkdirSync(repoDir);

  let result = runCmd('git', ['init', '-b', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  result = runCmd('git', ['config', 'user.email', 'bot@example.com'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  result = runCmd('git', ['config', 'user.name', 'Bot'], repoDir);
  assert.equal(result.status, 0, result.stderr);

  if (withPackageJson) {
    fs.writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({ name: path.basename(repoDir), private: true, scripts: {} }, null, 2) + '\n',
    );
  }

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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-origin-'));
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

function extractOpenSpecPlanSlug(output) {
  const match = String(output || '').match(/\[agent-branch-start\] OpenSpec plan: openspec\/plan\/(.+)/);
  assert.ok(match, `missing OpenSpec plan slug in output: ${output}`);
  return match[1].trim();
}

function extractOpenSpecChangeSlug(output) {
  const match = String(output || '').match(/\[agent-branch-start\] OpenSpec change: openspec\/changes\/(.+)/);
  assert.ok(match, `missing OpenSpec change slug in output: ${output}`);
  return match[1].trim();
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function waitForPidExit(pid, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return true;
    }
    cp.spawnSync('sleep', ['0.1'], { encoding: 'utf8' });
  }
  return !isPidAlive(pid);
}

function sanitizeSlug(value, fallback = 'task') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback;
}

const spawnProbe = cp.spawnSync(process.execPath, ['-e', 'process.exit(0)'], { encoding: 'utf8' });
const canSpawnChildProcesses = !spawnProbe.error && spawnProbe.status === 0;
const spawnUnavailableReason = spawnProbe.error
  ? `${spawnProbe.error.code || 'unknown'}: ${spawnProbe.error.message}`
  : `status=${spawnProbe.status}`;

if (!canSpawnChildProcesses) {
  test('self-update prompt requires explicit y/n when approval is not preconfigured', () => {
    const source = fs.readFileSync(cliPath, 'utf8');
    assert.match(
      source,
      /const shouldUpdate = interactive\s*\?\s*promptYesNoStrict\(\s*`Update now\?\s*\(\$\{NPM_BIN\} i -g \$\{packageJson\.name\}@latest\)`\s*,?\s*\)\s*:\s*autoApproval;/s,
    );
  });

  test('install integration suite requires child_process spawnSync support', { skip: `spawn unavailable (${spawnUnavailableReason})` }, () => {});
} else {

test('setup provisions workflow files and repo config', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OpenSpec core workflow: \/opsx:propose -> \/opsx:apply -> \/opsx:archive/);
  assert.match(result.stdout, /OpenSpec guide: docs\/openspec-getting-started\.md/);

  const requiredFiles = [
    '.omx',
    '.omx/state',
    '.omx/logs',
    '.omx/plans',
    '.omx/agent-worktrees',
    '.omx/notepad.md',
    '.omx/project-memory.json',
    'scripts/agent-branch-start.sh',
    'scripts/agent-branch-finish.sh',
    'scripts/codex-agent.sh',
    'scripts/review-bot-watch.sh',
    'scripts/agent-worktree-prune.sh',
    'scripts/agent-file-locks.py',
    'scripts/install-agent-git-hooks.sh',
    'scripts/openspec/init-plan-workspace.sh',
    'scripts/openspec/init-change-workspace.sh',
    '.githooks/pre-commit',
    '.githooks/pre-push',
    '.githooks/post-merge',
    '.codex/skills/guardex/SKILL.md',
    '.codex/skills/guardex-merge-skills-to-dev/SKILL.md',
    '.claude/commands/guardex.md',
    '.github/pull.yml.example',
    '.github/workflows/cr.yml',
    '.omx/state/agent-file-locks.json',
    '.gitignore',
    'AGENTS.md',
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(repoDir, relativePath)), true, `${relativePath} missing`);
  }

  const crWorkflow = fs.readFileSync(path.join(repoDir, '.github', 'workflows', 'cr.yml'), 'utf8');
  assert.match(crWorkflow, /name:\s+Code Review/);
  assert.match(crWorkflow, /pull_request:/);
  assert.match(crWorkflow, /OPENAI_API_KEY/);
  assert.match(crWorkflow, /anc95\/ChatGPT-CodeReview@main/);

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['agent:codex'], 'bash ./scripts/codex-agent.sh');
  assert.equal(packageJson.scripts['agent:review:watch'], 'bash ./scripts/review-bot-watch.sh');
  assert.equal(packageJson.scripts['agent:branch:start'], 'bash ./scripts/agent-branch-start.sh');
  assert.equal(packageJson.scripts['agent:finish'], 'gx finish --all');
  assert.equal(packageJson.scripts['agent:plan:init'], 'bash ./scripts/openspec/init-plan-workspace.sh');
  assert.equal(packageJson.scripts['agent:change:init'], 'bash ./scripts/openspec/init-change-workspace.sh');
  assert.equal(packageJson.scripts['agent:protect:list'], 'gx protect list');
  assert.equal(packageJson.scripts['agent:branch:sync'], 'gx sync');
  assert.equal(packageJson.scripts['agent:branch:sync:check'], 'gx sync --check');
  assert.equal(packageJson.scripts['agent:safety:setup'], 'gx setup');
  assert.equal(packageJson.scripts['agent:cleanup'], 'gx cleanup');

  const agentsContent = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(agentsContent.includes('<!-- multiagent-safety:START -->'), true);
  assert.match(
    agentsContent,
    /For every new task, including follow-up work in the same chat\/session, if an assigned agent sub-branch\/worktree is already open, continue in that sub-branch/,
  );

  const gitignoreContent = fs.readFileSync(path.join(repoDir, '.gitignore'), 'utf8');
  assert.match(gitignoreContent, /# multiagent-safety:START/);
  assert.match(gitignoreContent, /scripts\/agent-branch-start\.sh/);
  assert.match(gitignoreContent, /scripts\/codex-agent\.sh/);
  assert.match(gitignoreContent, /scripts\/review-bot-watch\.sh/);
  assert.match(gitignoreContent, /scripts\/agent-file-locks\.py/);
  assert.match(gitignoreContent, /scripts\/openspec\/init-change-workspace\.sh/);
  assert.match(gitignoreContent, /\.githooks\/pre-commit/);
  assert.match(gitignoreContent, /\.githooks\/pre-push/);
  assert.match(gitignoreContent, /\.githooks\/post-merge/);
  assert.match(gitignoreContent, /\.omx\//);
  assert.match(gitignoreContent, /oh-my-codex\//);
  assert.match(gitignoreContent, /\.codex\/skills\/guardex\/SKILL\.md/);
  assert.match(gitignoreContent, /\.codex\/skills\/guardex-merge-skills-to-dev\/SKILL\.md/);
  assert.match(gitignoreContent, /\.claude\/commands\/guardex\.md/);
  assert.match(gitignoreContent, /\.omx\/state\/agent-file-locks\.json/);
  assert.match(gitignoreContent, /# multiagent-safety:END/);

  result = runCmd('git', ['config', '--get', 'core.hooksPath'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '.githooks');

  const secondRun = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);
});

test('setup and doctor preserve existing AGENTS managed block by default', () => {
  const repoDir = initRepo();
  const customAgents = [
    '# AGENTS',
    '',
    '<!-- multiagent-safety:START -->',
    '## Multi-Agent Execution Contract (GX)',
    '- custom cleanup rule must stay untouched',
    '<!-- multiagent-safety:END -->',
    '',
    '## Repo-specific notes',
    '- keep this content',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(repoDir, 'AGENTS.md'), customAgents, 'utf8');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  let currentAgents = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(currentAgents, customAgents, 'setup should preserve existing managed block');
  assert.match(result.stdout, /preserved existing guardex-managed block/);

  result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  currentAgents = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(currentAgents, customAgents, 'doctor should preserve existing managed block');
  assert.match(result.stdout, /preserved existing guardex-managed block/);
});

test('setup and doctor preserve existing agent scripts in package.json by default', () => {
  const repoDir = initRepo();
  const packagePath = path.join(repoDir, 'package.json');
  const customPackage = {
    name: path.basename(repoDir),
    private: true,
    scripts: {
      'agent:branch:start': 'bash ./scripts/custom-branch-start.sh',
      'agent:cleanup': 'gx cleanup',
      test: 'node --test',
    },
  };
  fs.writeFileSync(packagePath, JSON.stringify(customPackage, null, 2) + '\n', 'utf8');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  let currentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.deepEqual(currentPackage.scripts, customPackage.scripts, 'setup should preserve existing agent scripts');
  assert.match(result.stdout, /preserved existing agent:\* scripts/);

  result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  currentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.deepEqual(currentPackage.scripts, customPackage.scripts, 'doctor should preserve existing agent scripts');
  assert.match(result.stdout, /preserved existing agent:\* scripts/);
});

test('setup --parent-workspace-view creates one-level-up VS Code workspace for repo + agent worktrees', () => {
  const repoDir = initRepo();
  const parentDir = path.dirname(repoDir);
  const workspacePath = path.join(parentDir, `${path.basename(repoDir)}-branches.code-workspace`);

  assert.equal(fs.existsSync(workspacePath), false, 'workspace file should not exist before setup');

  const result = runNode(
    ['setup', '--target', repoDir, '--no-global-install', '--parent-workspace-view'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /parent VS Code workspace view/);
  assert.match(result.stdout, /Parent workspace view:/);

  assert.equal(fs.existsSync(workspacePath), true, 'setup should create parent workspace file');
  const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
  assert.deepEqual(workspace.folders, [
    { path: path.basename(repoDir) },
    { path: `${path.basename(repoDir)}/.omx/agent-worktrees` },
  ]);
  assert.equal(workspace.settings['scm.alwaysShowRepositories'], true);
});

test('setup --parent-workspace-view respects dry-run and does not write parent workspace file', () => {
  const repoDir = initRepo();
  const parentDir = path.dirname(repoDir);
  const workspacePath = path.join(parentDir, `${path.basename(repoDir)}-branches.code-workspace`);

  const result = runNode(
    ['setup', '--target', repoDir, '--no-global-install', '--parent-workspace-view', '--dry-run'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /would-create\s+\.\.\/repo-branches\.code-workspace \(parent VS Code workspace view\)/);
  assert.equal(fs.existsSync(workspacePath), false, 'dry run must not create parent workspace file');
});

test('setup refreshes existing managed AGENTS block to latest template policy', () => {
  const repoDir = initRepo();
  const legacyAgents = `# AGENTS

Project-specific guidance before managed block.

<!-- multiagent-safety:START -->
## Multi-Agent Execution Contract (multiagent-safety)
- legacy managed clause
<!-- multiagent-safety:END -->

Trailing project notes after managed block.
`;
  fs.writeFileSync(path.join(repoDir, 'AGENTS.md'), legacyAgents, 'utf8');

  const result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const nextAgents = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.match(nextAgents, /Project-specific guidance before managed block\./);
  assert.match(nextAgents, /Trailing project notes after managed block\./);
  assert.match(
    nextAgents,
    /For every new task, including follow-up work in the same chat\/session, if an assigned agent sub-branch\/worktree is already open, continue in that sub-branch/,
  );
  assert.match(
    nextAgents,
    /Never implement directly on the local\/base branch checkout; keep it unchanged and perform all edits in the agent sub-branch\/worktree\./,
  );
  assert.doesNotMatch(nextAgents, /legacy managed clause/);
});

test('setup auto-adds existing local user branches to protected branches', () => {
  const repoDir = initRepo();

  let result = runCmd('git', ['checkout', '-b', 'release/2026-q2'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['config', '--get', 'multiagent.protectedBranches'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), 'dev main master release/2026-q2');

  const secondRun = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);

  result = runCmd('git', ['config', '--get', 'multiagent.protectedBranches'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), 'dev main master release/2026-q2');
});

test('init aliases setup and provisions workflow files', () => {
  const repoDir = initRepo();

  const result = runNode(['init', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  assert.equal(fs.existsSync(path.join(repoDir, 'scripts', 'agent-branch-start.sh')), true);
  assert.equal(fs.existsSync(path.join(repoDir, 'scripts', 'agent-branch-finish.sh')), true);
  assert.equal(fs.existsSync(path.join(repoDir, 'AGENTS.md')), true);
});

test('review-bot-watch script prints help after setup', () => {
  const repoDir = initRepo();

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const helpResult = runCmd('bash', ['scripts/review-bot-watch.sh', '--help'], repoDir);
  assert.equal(helpResult.status, 0, helpResult.stderr || helpResult.stdout);
  assert.match(helpResult.stdout, /Continuously monitor GitHub pull requests targeting a base branch/);
});

test('review-bot-watch uses explicit codex-agent flags for argument parsing compatibility', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'review-bot-watch.sh'), 'utf8');
  assert.match(script, /--task \"\$task_name\"/);
  assert.match(script, /--agent \"\$AGENT_NAME\"/);
  assert.match(script, /--base \"\$BASE_BRANCH\"/);
  assert.match(script, /-- exec \"\$prompt\"/);
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

test('install configures AGENTS managed policy block with GX contract wording', () => {
  const repoDir = initRepo();

  const result = runNode(['install', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /AGENTS\.md managed policy block is configured by install\./);

  const agentsContent = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.match(agentsContent, /<!-- multiagent-safety:START -->/);
  assert.match(agentsContent, /## Multi-Agent Execution Contract \(GX\)/);
  assert.match(
    agentsContent,
    /OMX completion policy: when a task is done, the agent must commit the task changes, push the agent branch, and create\/update a PR/,
  );
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

test('doctor keeps protected base checkout on main even if local starter script switches branches in-place', () => {
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

  const legacyStartScript = path.join(repoDir, 'scripts', 'agent-branch-start.sh');
  fs.writeFileSync(
    legacyStartScript,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'branch_name="agent/legacy/doctor-in-place"\n' +
      'git checkout -B "$branch_name"\n' +
      'echo "[agent-branch-start] Created in-place branch: ${branch_name}"\n',
    'utf8',
  );
  fs.chmodSync(legacyStartScript, 0o755);

  result = runCmd('git', ['add', '-f', 'scripts/agent-branch-start.sh'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'simulate legacy in-place starter'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /doctor detected protected branch 'main'/);
  assert.match(extractCreatedBranch(result.stdout), /^agent\/gx\/.+-gx-doctor$/);

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

test('doctor on protected main bootstraps sandbox branch even before setup exists', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);

  const result = runNode(['doctor', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /doctor detected protected branch 'main'/);
  assert.match(result.stdout, /\.omx scaffold/);
  const createdBranch = extractCreatedBranch(result.stdout);
  const createdWorktree = extractCreatedWorktree(result.stdout);
  assert.match(createdBranch, /^agent\/gx\/.+-gx-doctor$/);
  assert.equal(fs.existsSync(path.join(createdWorktree, 'scripts', 'agent-branch-start.sh')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'state')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'logs')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'plans')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'agent-worktrees')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'notepad.md')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'project-memory.json')), true);

  const rootStatus = runCmd('git', ['status', '--short', '--untracked-files=no'], repoDir);
  assert.equal(rootStatus.status, 0, rootStatus.stderr || rootStatus.stdout);
  assert.equal(rootStatus.stdout.trim(), '', 'protected main checkout should keep tracked files clean');

  const currentBranch = runCmd('git', ['branch', '--show-current'], repoDir);
  assert.equal(currentBranch.status, 0, currentBranch.stderr || currentBranch.stdout);
  assert.equal(currentBranch.stdout.trim(), 'main');
});

test('doctor on protected main auto-commits sandbox repairs and runs PR finish flow when gh is authenticated', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  attachOriginRemoteForBranch(repoDir, 'main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.rmSync(path.join(repoDir, 'AGENTS.md'));
  result = runCmd('git', ['add', '-A'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'simulate drift remove agents'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "auth" && "$2" == "status" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/doctor-autofinish"
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

  result = runNodeWithEnv(['doctor', '--target', repoDir], repoDir, { GUARDEX_GH_BIN: fakeGhPath });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Auto-committed doctor repairs in sandbox branch/);
  assert.match(result.stdout, /Auto-finish flow completed for sandbox branch/);

  const createdBranch = extractCreatedBranch(result.stdout);
  result = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${createdBranch}`], repoDir);
  assert.equal(result.status, 0, 'doctor auto-finish should keep sandbox branch locally by default');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', createdBranch], repoDir);
  assert.match(result.stdout, /refs\/heads\//, 'doctor auto-finish should push sandbox branch to origin');

  const rootStatus = runCmd('git', ['status', '--short', '--untracked-files=no'], repoDir);
  assert.equal(rootStatus.status, 0, rootStatus.stderr || rootStatus.stdout);
  assert.equal(rootStatus.stdout.trim(), '', 'protected main checkout should stay clean');
});

test('doctor on protected main fails when sandbox PR is not merged', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  attachOriginRemoteForBranch(repoDir, 'main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.rmSync(path.join(repoDir, 'AGENTS.md'));
  result = runCmd('git', ['add', '-A'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'simulate drift remove agents'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const ghLogPath = path.join(repoDir, 'gh-calls-unmerged.log');
  const { fakePath: fakeGhPath } = createFakeGhScript(`
echo "$*" >> "${ghLogPath}"
if [[ "$1" == "auth" && "$2" == "status" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/doctor-autofinish-unmerged"
    exit 0
  fi
  if [[ " $* " == *" --json state,mergedAt,url "* ]]; then
    printf "CLOSED\\x1f\\x1fhttps://example.test/pr/doctor-autofinish-unmerged\\n"
    exit 0
  fi
  echo "unexpected gh pr view args: $*" >&2
  exit 1
fi
if [[ "$1" == "pr" && "$2" == "merge" ]]; then
  echo "X Pull request recodeecom/guardex#999 is not mergeable: the base branch policy prohibits the merge." >&2
  exit 1
fi
echo "unexpected gh args: $*" >&2
exit 1
`);

  result = runNodeWithEnv(['doctor', '--target', repoDir], repoDir, { GUARDEX_GH_BIN: fakeGhPath });
  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  const ghCalls = fs.readFileSync(ghLogPath, 'utf8');
  assert.match(ghCalls, /pr merge/);
  assert.match(ghCalls, /pr view .* --json state,mergedAt,url/);
  assert.doesNotMatch(ghCalls, /pr merge .* --auto/);
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  assert.match(combinedOutput, /PR closed without merge; cannot continue auto-finish/);
  assert.match(combinedOutput, /\[guardex\] Auto-finish flow failed for sandbox branch/);
  assert.doesNotMatch(combinedOutput, /Auto-finish flow completed for sandbox branch/);
});

test('doctor auto-finishes clean pending agent branches against the current local base branch', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  attachOriginRemoteForBranch(repoDir, 'main');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['push', 'origin', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd(
    'bash',
    ['scripts/agent-branch-start.sh', 'doctor-ready-finish', 'planner', 'main'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const readyBranch = extractCreatedBranch(result.stdout);
  const readyWorktree = extractCreatedWorktree(result.stdout);

  fs.writeFileSync(path.join(readyWorktree, 'doctor-ready-finish.txt'), 'ready for finish\n', 'utf8');
  result = runCmd('git', ['add', 'doctor-ready-finish.txt'], readyWorktree);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '--no-verify', '-m', 'doctor ready branch change'], readyWorktree);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const ghLogPath = path.join(repoDir, '.doctor-auto-finish-gh.log');
  const { fakePath: fakeGhPath } = createFakeGhScript(`
LOG_PATH="${ghLogPath}"
echo "$*" >> "$LOG_PATH"
if [[ "$1" == "--version" ]]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/doctor-auto-finish-ready"
    exit 0
  fi
  if [[ " $* " == *" --json state,mergedAt,url "* ]]; then
    printf "OPEN\\x1f\\x1f%s\\n" "https://example.test/pr/doctor-auto-finish-ready"
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

  result = runNodeWithEnv(['doctor', '--target', repoDir], repoDir, {
    GUARDEX_GH_BIN: fakeGhPath,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  assert.match(combinedOutput, /Auto-finish sweep \(base=main\): attempted=1, completed=1, skipped=\d+, failed=0/);
  assert.match(combinedOutput, /\[done\] agent\/planner\/.*doctor-ready-finish.*: auto-finish completed\./);

  const ghCalls = fs.readFileSync(ghLogPath, 'utf8');
  assert.match(ghCalls, /pr create/);
  assert.match(ghCalls, /pr merge/);

  result = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${readyBranch}`], repoDir);
  assert.notEqual(result.status, 0, 'doctor auto-finish should remove local ready branch');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', readyBranch], repoDir);
  assert.equal(result.stdout.trim(), '', 'doctor auto-finish should remove remote ready branch');
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

test('setup pre-commit detects codex commit attempts on protected main (including VS Code env) and requires GuardeX sub-branch', () => {
  const repoDir = initRepoOnBranch('main');

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(repoDir, 'notes-main.txt'), 'hello from main\n', 'utf8');
  result = runCmd('git', ['add', 'notes-main.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['commit', '-m', 'codex protected commit'], repoDir, {
    CODEX_THREAD_ID: 'test-thread',
    VSCODE_GIT_IPC_HANDLE: '1',
    VSCODE_GIT_ASKPASS_NODE: '1',
    VSCODE_IPC_HOOK_CLI: '1',
  });
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

test('setup agent-branch-start rejects in-place flags to keep local checkout unchanged', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  seedCommit(repoDir);

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'demo', 'bot', 'dev', '--in-place'], repoDir);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /In-place branch mode is disabled/);
  assert.match(result.stderr, /always creates an isolated worktree/);

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'demo', 'bot', 'dev', '--allow-in-place'], repoDir);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /In-place branch mode is disabled/);
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
  assert.match(result.stdout, /Created branch: agent\/planner\/zeus-edix-hu-restore-snapshot-[0-9]{6}(?:-\d+)?/);
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
    { env: { GUARDEX_CODEX_AUTH_SNAPSHOT: 'Prod Snapshot One' } },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Created branch: agent\/bot\/prod-snapshot-one-ship-fix-[0-9]{6}(?:-\d+)?/);
});

test('setup agent-branch-start compacts long snapshot/task names for readable branch labels', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  result = runCmd(
    'bash',
    [
      'scripts/agent-branch-start.sh',
      'rust-layer-phase7-dashboard-read-name-columns-and-badges',
      'codex-admin-recodee-com',
      'dev',
    ],
    repoDir,
    { env: { GUARDEX_CODEX_AUTH_SNAPSHOT: 'Zeus Portasmosonmagyarovar Hu Snapshot' } },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const createdBranch = extractCreatedBranch(result.stdout);
  assert.match(createdBranch, /^agent\/codex-admin-recodee-com\/[a-z0-9-]+$/);
  assert.ok(createdBranch.length <= 100, `branch should stay compact, got: ${createdBranch}`);
  const branchLeaf = createdBranch.split('/').pop() || '';
  assert.ok(branchLeaf.length <= 70, `branch leaf should stay compact, got: ${branchLeaf}`);
  assert.match(branchLeaf, /^zeus-portasmosonma-rust-layer-phase7-dashboard-read-name-[0-9]{6}(?:-\d+)?$/);
});

test('setup agent-branch-start supports optional OpenSpec auto-bootstrap toggles', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  result = runCmd(
    'bash',
    ['scripts/agent-branch-start.sh', 'openspec-default', 'bot', 'dev'],
    repoDir,
    { env: { GUARDEX_OPENSPEC_AUTO_INIT: 'true' } },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const defaultBranch = extractCreatedBranch(result.stdout);
  const defaultWorktree = extractCreatedWorktree(result.stdout);
  const defaultPlanSlug = extractOpenSpecPlanSlug(result.stdout);
  const defaultChangeSlug = extractOpenSpecChangeSlug(result.stdout);
  assert.equal(defaultPlanSlug, sanitizeSlug(defaultBranch, 'openspec-default'));
  assert.equal(defaultChangeSlug, sanitizeSlug(defaultBranch, 'openspec-default'));
  assert.equal(
    fs.existsSync(path.join(defaultWorktree, 'openspec', 'plan', defaultPlanSlug, 'summary.md')),
    true,
    'default branch start should scaffold OpenSpec plan workspace',
  );
  assert.equal(
    fs.existsSync(path.join(defaultWorktree, 'openspec', 'changes', defaultChangeSlug, 'proposal.md')),
    true,
    'default branch start should scaffold OpenSpec change proposal',
  );
  assert.equal(
    fs.existsSync(path.join(defaultWorktree, 'openspec', 'changes', defaultChangeSlug, 'tasks.md')),
    true,
    'default branch start should scaffold OpenSpec change tasks',
  );
  assert.equal(
    fs.existsSync(
      path.join(
        defaultWorktree,
        'openspec',
        'changes',
        defaultChangeSlug,
        'specs',
        'openspec-default',
        'spec.md',
      ),
    ),
    true,
    'default branch start should scaffold OpenSpec change spec',
  );

  result = runCmd(
    'bash',
    ['scripts/agent-branch-start.sh', 'openspec-disabled', 'bot', 'dev'],
    repoDir,
    { env: { GUARDEX_OPENSPEC_AUTO_INIT: 'false' } },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const disabledWorktree = extractCreatedWorktree(result.stdout);
  const disabledPlanSlug = extractOpenSpecPlanSlug(result.stdout);
  const disabledChangeSlug = extractOpenSpecChangeSlug(result.stdout);
  assert.equal(
    fs.existsSync(path.join(disabledWorktree, 'openspec', 'plan', disabledPlanSlug, 'summary.md')),
    false,
    'OpenSpec auto-bootstrap should be skippable via GUARDEX_OPENSPEC_AUTO_INIT=false',
  );
  assert.equal(
    fs.existsSync(path.join(disabledWorktree, 'openspec', 'changes', disabledChangeSlug, 'proposal.md')),
    false,
    'OpenSpec change bootstrap should be skippable via GUARDEX_OPENSPEC_AUTO_INIT=false',
  );
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

  const storedBase = runCmd('git', ['config', '--get', `branch.${agentBranch}.guardexBase`], repoDir);
  assert.equal(storedBase.status, 0, storedBase.stderr || storedBase.stdout);
  assert.equal(storedBase.stdout.trim(), 'main');
});

test('agent-branch-start prefers current protected branch over stale configured base and auto-transfers local changes', () => {
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

  result = runCmd('git', ['checkout', '-b', 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['config', 'multiagent.baseBranch', 'main'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const packageJsonPath = path.join(repoDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.name = 'demo-prefer-dev';
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(repoDir, 'dev-untracked.txt'), 'dev untracked change\n', 'utf8');

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'prefer-dev', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Moved local changes from 'dev' into 'agent\/bot\//);

  const agentWorktree = extractCreatedWorktree(result.stdout);
  const storedBase = runCmd(
    'git',
    ['config', '--get', `branch.${extractCreatedBranch(result.stdout)}.guardexBase`],
    repoDir,
  );
  assert.equal(storedBase.status, 0, storedBase.stderr || storedBase.stdout);
  assert.equal(storedBase.stdout.trim(), 'dev');

  const rootStatus = runCmd('git', ['status', '--short'], repoDir);
  assert.equal(rootStatus.status, 0, rootStatus.stderr || rootStatus.stdout);
  assert.equal(rootStatus.stdout.trim(), '', 'current protected checkout should be clean after auto-transfer');

  assert.match(fs.readFileSync(path.join(agentWorktree, 'package.json'), 'utf8'), /"name": "demo-prefer-dev"/);
  assert.equal(fs.existsSync(path.join(agentWorktree, 'dev-untracked.txt')), true, 'untracked file should move');

  const stashList = runCmd('git', ['stash', 'list'], repoDir);
  assert.equal(stashList.status, 0, stashList.stderr || stashList.stdout);
  assert.doesNotMatch(stashList.stdout, /guardex-auto-transfer-/);
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

  const rootStatus = runCmd('git', ['status', '--short'], repoDir);
  assert.equal(rootStatus.status, 0, rootStatus.stderr || rootStatus.stdout);
  assert.equal(rootStatus.stdout.trim(), '', 'base branch checkout should be clean after auto-transfer');

  assert.match(fs.readFileSync(path.join(agentWorktree, 'package.json'), 'utf8'), /"name": "demo-edited"/);
  assert.equal(fs.existsSync(path.join(agentWorktree, 'scratch-note.txt')), true, 'untracked file should move');

  const stashList = runCmd('git', ['stash', 'list'], repoDir);
  assert.equal(stashList.status, 0, stashList.stderr || stashList.stdout);
  assert.doesNotMatch(stashList.stdout, /guardex-auto-transfer-/);
});

test('agent-branch-start hydrates codex-agent helper into new worktrees when missing locally', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const localCodexAgent = path.join(repoDir, 'scripts', 'codex-agent.sh');
  assert.equal(fs.existsSync(localCodexAgent), true, 'setup should provision local codex-agent helper');

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'hydrate-codex', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Hydrated local helper in worktree: scripts\/codex-agent\.sh/);

  const createdWorktree = extractCreatedWorktree(result.stdout);
  const worktreeCodexAgent = path.join(createdWorktree, 'scripts', 'codex-agent.sh');
  assert.equal(fs.existsSync(worktreeCodexAgent), true, 'worktree should receive codex-agent helper');
  const mode = fs.statSync(worktreeCodexAgent).mode;
  assert.equal((mode & 0o111) !== 0, true, 'hydrated codex-agent helper should be executable');
});

test('agent-branch-start links dependency node_modules directories into new worktrees when present', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['add', '.'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['commit', '-m', 'apply gx setup'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '1',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const infoExcludePath = path.join(repoDir, '.git', 'info', 'exclude');
  fs.appendFileSync(infoExcludePath, '\napps/frontend/node_modules\napps/backend/node_modules\n', 'utf8');

  const dependencyDirs = ['node_modules', 'apps/frontend/node_modules', 'apps/backend/node_modules'];
  for (const relativeDir of dependencyDirs) {
    const sourceDir = path.join(repoDir, relativeDir);
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, '.guardex-link-marker'), 'present\n', 'utf8');
  }

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'hydrate-deps', 'bot'], repoDir, {
    GUARDEX_PROTECTED_BRANCHES: 'main',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Linked dependency dir in worktree: node_modules/);
  assert.match(result.stdout, /Linked dependency dir in worktree: apps\/frontend\/node_modules/);
  assert.match(result.stdout, /Linked dependency dir in worktree: apps\/backend\/node_modules/);

  const createdWorktree = extractCreatedWorktree(result.stdout);
  for (const relativeDir of dependencyDirs) {
    const sourceDir = path.join(repoDir, relativeDir);
    const linkedDir = path.join(createdWorktree, relativeDir);
    assert.equal(fs.existsSync(linkedDir), true, `worktree path should exist: ${relativeDir}`);
    assert.equal(fs.lstatSync(linkedDir).isSymbolicLink(), true, `worktree path should be a symlink: ${relativeDir}`);
    assert.equal(fs.readlinkSync(linkedDir), sourceDir, `symlink should target source dependency dir: ${relativeDir}`);
    assert.equal(
      fs.existsSync(path.join(linkedDir, '.guardex-link-marker')),
      true,
      `symlink should expose source contents: ${relativeDir}`,
    );
  }
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
  assert.match(
    result.stdout,
    /AGENT BOT\n\s+review\s+Start PR monitor \+ codex-agent review flow \(default interval: 30s\)/,
  );
  assert.match(result.stdout, /AGENT BOT[\s\S]*\n\s+agents\s+Start\/stop both review and cleanup bots for this repo/);
  assert.equal(fs.existsSync(path.join(repoDir, '.githooks', 'pre-commit')), false);
});

test('review command launches local review-bot script and accepts legacy start token', () => {
  const repoDir = initRepo();
  const scriptsDir = path.join(repoDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const reviewScript = path.join(scriptsDir, 'review-bot-watch.sh');
  const markerCwd = path.join(repoDir, '.review-bot-cwd');
  const markerArgs = path.join(repoDir, '.review-bot-args');
  fs.writeFileSync(
    reviewScript,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      `printf '%s\\n' \"$PWD\" > \"${markerCwd}\"\n` +
      `printf '%s\\n' \"$*\" > \"${markerArgs}\"\n`,
    'utf8',
  );
  fs.chmodSync(reviewScript, 0o755);

  const result = runNode(['review', 'start', '--target', repoDir, '--interval', '45', '--once'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(markerCwd, 'utf8').trim(), repoDir);
  assert.equal(fs.readFileSync(markerArgs, 'utf8').trim(), '--interval 45 --once');
});

test('review command explains setup + doctor steps when script is missing in target repo', () => {
  const repoDir = initRepo();

  const result = runNode(['review', '--target', repoDir], repoDir);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(
    result.stderr,
    new RegExp(`Run 'gx setup --target ${escapeRegexLiteral(repoDir)}' then 'gx doctor --target ${escapeRegexLiteral(repoDir)}'`),
  );
});

test('agents command starts review+cleanup bots for the target repo and stops them', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  const scriptsDir = path.join(repoDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const reviewScriptPath = path.join(scriptsDir, 'review-bot-watch.sh');
  fs.writeFileSync(
    reviewScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'while true; do sleep 60; done\n',
    'utf8',
  );
  fs.chmodSync(reviewScriptPath, 0o755);

  const pruneScriptPath = path.join(scriptsDir, 'agent-worktree-prune.sh');
  fs.writeFileSync(
    pruneScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'exit 0\n',
    'utf8',
  );
  fs.chmodSync(pruneScriptPath, 0o755);

  let result = runNode(
    [
      'agents',
      'start',
      '--target',
      repoDir,
      '--review-interval',
      '31',
      '--cleanup-interval',
      '47',
      '--idle-minutes',
      '12',
    ],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Started repo agents/);

  const statePath = path.join(repoDir, '.omx', 'state', 'agents-bots.json');
  assert.equal(fs.existsSync(statePath), true, 'agents start should create state file');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.repoRoot, repoDir);
  assert.equal(state.review.intervalSeconds, 31);
  assert.equal(state.cleanup.intervalSeconds, 47);
  assert.equal(state.cleanup.idleMinutes, 12);
  assert.equal(isPidAlive(state.review.pid), true, 'review bot pid should be alive after start');
  assert.equal(isPidAlive(state.cleanup.pid), true, 'cleanup bot pid should be alive after start');

  result = runNode(['agents', 'stop', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Stopped repo agents/);
  assert.equal(waitForPidExit(state.review.pid), true, 'review bot pid should exit after stop');
  assert.equal(waitForPidExit(state.cleanup.pid), true, 'cleanup bot pid should exit after stop');
  assert.equal(fs.existsSync(statePath), false, 'agents stop should remove state file');
});

test('agents start reuses running review bot when only cleanup bot is missing', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  const scriptsDir = path.join(repoDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const reviewScriptPath = path.join(scriptsDir, 'review-bot-watch.sh');
  fs.writeFileSync(
    reviewScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'while true; do sleep 60; done\n',
    'utf8',
  );
  fs.chmodSync(reviewScriptPath, 0o755);

  const pruneScriptPath = path.join(scriptsDir, 'agent-worktree-prune.sh');
  fs.writeFileSync(
    pruneScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'exit 0\n',
    'utf8',
  );
  fs.chmodSync(pruneScriptPath, 0o755);

  let result = runNode(
    ['agents', 'start', '--target', repoDir, '--review-interval', '31', '--cleanup-interval', '47', '--idle-minutes', '12'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const statePath = path.join(repoDir, '.omx', 'state', 'agents-bots.json');
  const firstState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const firstReviewPid = firstState.review.pid;
  const firstCleanupPid = firstState.cleanup.pid;
  assert.equal(isPidAlive(firstReviewPid), true, 'review bot should be alive after initial start');
  assert.equal(isPidAlive(firstCleanupPid), true, 'cleanup bot should be alive after initial start');

  process.kill(firstCleanupPid, 'SIGTERM');
  assert.equal(waitForPidExit(firstCleanupPid), true, 'cleanup bot should stop during simulation');
  assert.equal(isPidAlive(firstReviewPid), true, 'review bot should remain alive before restart');

  result = runNode(
    ['agents', 'start', '--target', repoDir, '--review-interval', '30', '--cleanup-interval', '60', '--idle-minutes', '60'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Reused healthy bot process\(es\) and started only missing ones\./);

  const secondState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(secondState.review.pid, firstReviewPid, 'running review bot should be reused');
  assert.notEqual(secondState.cleanup.pid, firstCleanupPid, 'missing cleanup bot should be restarted');
  assert.equal(isPidAlive(secondState.review.pid), true, 'reused review bot should stay alive');
  assert.equal(isPidAlive(secondState.cleanup.pid), true, 'new cleanup bot should be alive');

  result = runNode(['agents', 'stop', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(waitForPidExit(secondState.review.pid), true, 'review bot pid should exit after stop');
  assert.equal(waitForPidExit(secondState.cleanup.pid), true, 'cleanup bot pid should exit after stop');
});

test('agents cleanup bot defaults to a 60-minute idle threshold', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  const scriptsDir = path.join(repoDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const reviewScriptPath = path.join(scriptsDir, 'review-bot-watch.sh');
  fs.writeFileSync(
    reviewScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'while true; do sleep 60; done\n',
    'utf8',
  );
  fs.chmodSync(reviewScriptPath, 0o755);

  const pruneScriptPath = path.join(scriptsDir, 'agent-worktree-prune.sh');
  fs.writeFileSync(
    pruneScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'exit 0\n',
    'utf8',
  );
  fs.chmodSync(pruneScriptPath, 0o755);

  let result = runNode(['agents', 'start', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const statePath = path.join(repoDir, '.omx', 'state', 'agents-bots.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.cleanup.idleMinutes, 60);
  assert.equal(isPidAlive(state.review.pid), true, 'review bot pid should be alive after start');
  assert.equal(isPidAlive(state.cleanup.pid), true, 'cleanup bot pid should be alive after start');

  result = runNode(['agents', 'stop', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(waitForPidExit(state.review.pid), true, 'review bot pid should exit after stop');
  assert.equal(waitForPidExit(state.cleanup.pid), true, 'cleanup bot pid should exit after stop');
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

  result = runCmd('bash', ['scripts/agent-branch-start.sh', 'finish-all', 'bot'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const agentBranch = extractCreatedBranch(result.stdout);
  const agentWorktree = extractCreatedWorktree(result.stdout);

  fs.writeFileSync(path.join(agentWorktree, 'finisher-note.txt'), 'pending branch finish\n', 'utf8');

  const finishLog = path.join(repoDir, '.finish-invocations.log');
  fs.writeFileSync(
    path.join(repoDir, 'scripts', 'agent-branch-finish.sh'),
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      `printf '%s\\n' \"$*\" >> \"${finishLog}\"\n`,
    'utf8',
  );
  fs.chmodSync(path.join(repoDir, 'scripts', 'agent-branch-finish.sh'), 0o755);

  result = runNode(
    ['finish', '--target', repoDir, '--branch', agentBranch, '--base', 'main', '--no-wait-for-merge', '--no-cleanup'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`Finishing '${escapeRegexLiteral(agentBranch)}' -> 'main'`));
  assert.match(result.stdout, /Auto-committed/);
  assert.match(result.stdout, /Finish summary: total=1, success=1, failed=0, autoCommitted=1/);

  const finishInvocations = fs.readFileSync(finishLog, 'utf8');
  assert.match(finishInvocations, new RegExp(`--branch ${escapeRegexLiteral(agentBranch)}`));
  assert.match(finishInvocations, /--base main/);
  assert.match(finishInvocations, /--via-pr/);
  assert.match(finishInvocations, /--no-wait-for-merge/);
  assert.match(finishInvocations, /--no-cleanup/);

  const worktreeStatus = runCmd('git', ['status', '--short'], agentWorktree);
  assert.equal(worktreeStatus.status, 0, worktreeStatus.stderr || worktreeStatus.stdout);
  assert.equal(worktreeStatus.stdout.trim(), '', 'agent worktree should be clean after auto-commit');

  const latestSubject = runCmd('git', ['log', '-1', '--pretty=%s'], agentWorktree);
  assert.equal(latestSubject.status, 0, latestSubject.stderr || latestSubject.stdout);
  assert.equal(latestSubject.stdout.trim(), `Auto-finish: ${agentBranch}`);
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

test('warning-only degraded status avoids zero-error wording and improves scan hint', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('git', ['config', 'core.hooksPath', '.bad-hooks'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['status', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Repo safety service: .*degraded \(\d+ warning\(s\)\)\./);
  assert.doesNotMatch(result.stdout, /0 error\(s\),/);
  assert.match(result.stdout, /Run 'guardex scan' to review warning details\./);
});

test('default invocation outside git repo reports inactive repo service', () => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-non-repo-'));

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

test('self-update prompt requires explicit y/n when approval is not preconfigured', () => {
  const source = fs.readFileSync(cliPath, 'utf8');
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
  const source = fs.readFileSync(cliPath, 'utf8');
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

test('pre-commit blocks non-codex VS Code commits on custom protected branches by default when branch has remote counterpart', () => {
  const repoDir = initRepoOnBranch('release');
  seedCommit(repoDir);
  attachOriginRemoteForBranch(repoDir, 'release');

  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runNode(['protect', 'add', 'release', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const hookResult = runCmd('bash', ['.githooks/pre-commit'], repoDir, {
    ALLOW_COMMIT_ON_PROTECTED_BRANCH: '0',
    VSCODE_GIT_IPC_HANDLE: '1',
  });
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /\[agent-branch-guard\] Direct commits on protected branches are blocked\./);
});

test('pre-commit blocks non-codex protected branch commits from VS Code Source Control env by default', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

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
  assert.match(hookResult.stderr, /\[agent-branch-guard\] Direct commits on protected branches are blocked\./);
});

test('pre-commit blocks non-codex VS Code commits on protected local-only branches by default', () => {
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
  assert.match(hookResult.stderr, /\[agent-branch-guard\] Direct commits on protected branches are blocked\./);
});

test('pre-commit blocks codex commits on protected local-only branches even from VS Code Source Control env', () => {
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
      CODEX_THREAD_ID: 'test-thread',
      VSCODE_GIT_IPC_HANDLE: '1',
      VSCODE_GIT_ASKPASS_NODE: '1',
      VSCODE_IPC_HOOK_CLI: '1',
    },
  );
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /\[guardex-preedit-guard\] Codex edit\/commit detected on a protected branch\./);
});

test('pre-push blocks non-codex protected branch pushes from VS Code Source Control env by default', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const hookResult = runCmd(
    'bash',
    [
      '-lc',
      `printf '%s\\n' 'refs/heads/main 1111111111111111111111111111111111111111 refs/heads/main 0000000000000000000000000000000000000000' | .githooks/pre-push origin origin`,
    ],
    repoDir,
    {
      VSCODE_GIT_IPC_HANDLE: '1',
      VSCODE_GIT_ASKPASS_NODE: '1',
      VSCODE_IPC_HOOK_CLI: '1',
    },
  );
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /\[agent-branch-guard\] Push to protected branch blocked\./);
});

test('pre-commit blocks non-codex protected branch commits from VS Code Source Control env when explicitly disabled', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  let configResult = runCmd(
    'git',
    ['config', 'multiagent.allowVscodeProtectedBranchWrites', 'false'],
    repoDir,
  );
  assert.equal(configResult.status, 0, configResult.stderr || configResult.stdout);

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
  assert.match(hookResult.stderr, /\[agent-branch-guard\] Direct commits on protected branches are blocked\./);
});

test('pre-commit does not treat TERM_PROGRAM=vscode as VS Code Source Control context', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  attachOriginRemote(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  let configResult = runCmd(
    'git',
    ['config', 'multiagent.allowVscodeProtectedBranchWrites', 'true'],
    repoDir,
  );
  assert.equal(configResult.status, 0, configResult.stderr || configResult.stdout);

  const hookResult = runCmd(
    'bash',
    ['.githooks/pre-commit'],
    repoDir,
    {
      ALLOW_COMMIT_ON_PROTECTED_BRANCH: '0',
      TERM_PROGRAM: 'vscode',
    },
  );
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /\[agent-branch-guard\] Direct commits on protected branches are blocked\./);
});

test('pre-push allows non-codex protected branch pushes from VS Code Source Control env when explicitly enabled', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  let configResult = runCmd(
    'git',
    ['config', 'multiagent.allowVscodeProtectedBranchWrites', 'true'],
    repoDir,
  );
  assert.equal(configResult.status, 0, configResult.stderr || configResult.stdout);

  const hookResult = runCmd(
    'bash',
    [
      '-lc',
      `printf '%s\\n' 'refs/heads/main 1111111111111111111111111111111111111111 refs/heads/main 0000000000000000000000000000000000000000' | .githooks/pre-push origin origin`,
    ],
    repoDir,
    {
      VSCODE_GIT_IPC_HANDLE: '1',
      VSCODE_GIT_ASKPASS_NODE: '1',
      VSCODE_IPC_HOOK_CLI: '1',
    },
  );
  assert.equal(hookResult.status, 0, hookResult.stderr || hookResult.stdout);
});

test('pre-push blocks codex protected branch pushes even from VS Code Source Control env', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const hookResult = runCmd(
    'bash',
    [
      '-lc',
      `printf '%s\\n' 'refs/heads/main 1111111111111111111111111111111111111111 refs/heads/main 0000000000000000000000000000000000000000' | .githooks/pre-push origin origin`,
    ],
    repoDir,
    {
      CODEX_THREAD_ID: 'test-thread',
      VSCODE_GIT_IPC_HANDLE: '1',
      VSCODE_GIT_ASKPASS_NODE: '1',
      VSCODE_IPC_HOOK_CLI: '1',
    },
  );
  assert.equal(hookResult.status, 1, hookResult.stderr || hookResult.stdout);
  assert.match(hookResult.stderr, /\[guardex-preedit-guard\] Codex push detected toward protected branch\./);
});

test('post-merge auto-runs cleanup on base branch and skips non-base branches', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const markerPath = path.join(repoDir, '.post-merge-cleanup-args');
  fs.writeFileSync(
    path.join(repoDir, 'bin', 'multiagent-safety.js'),
    '#!/usr/bin/env node\n' +
      "const fs = require('node:fs');\n" +
      "const marker = process.env.GUARDEX_POST_MERGE_MARKER;\n" +
      "if (marker) fs.appendFileSync(marker, process.argv.slice(2).join(' ') + '\\n', 'utf8');\n",
    'utf8',
  );

  let result = runCmd('bash', ['.githooks/post-merge', '0'], repoDir, {
    GUARDEX_POST_MERGE_MARKER: markerPath,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  let invocations = fs
    .readFileSync(markerPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  assert.equal(invocations.length, 1);
  assert.match(invocations[0], /^cleanup /);
  assert.match(invocations[0], new RegExp(`--target ${escapeRegexLiteral(repoDir)}`));
  assert.match(invocations[0], /--base dev/);
  assert.match(invocations[0], /--include-pr-merged/);
  assert.match(invocations[0], /--keep-clean-worktrees/);

  result = runCmd('git', ['checkout', '-b', 'feature/post-merge-skip'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('bash', ['.githooks/post-merge', '0'], repoDir, {
    GUARDEX_POST_MERGE_MARKER: markerPath,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  invocations = fs
    .readFileSync(markerPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  assert.equal(invocations.length, 1, 'post-merge should skip cleanup on non-base branch');
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

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-'));
  const fakeCodexPath = path.join(fakeBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${GUARDEX_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${GUARDEX_TEST_CODEX_ARGS}'}"\n`,
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
      GUARDEX_TEST_CODEX_CWD: cwdMarker,
      GUARDEX_TEST_CODEX_ARGS: argsMarker,
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
  assert.match(launch.stdout, /\[codex-agent\] OpenSpec change workspace:/);
  assert.match(launch.stdout, /\[codex-agent\] OpenSpec plan workspace:/);
  const launchedBranch = extractCreatedBranch(launch.stdout);
  const branchResult = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${launchedBranch}`], repoDir);
  assert.equal(branchResult.status, 0, 'agent branch should remain after default codex-agent run');
  const openspecPlanSlug = sanitizeSlug(launchedBranch, 'launch-task');
  const openspecChangeSlug = sanitizeSlug(launchedBranch, 'launch-task');
  assert.equal(
    fs.existsSync(path.join(launchedCwd, 'openspec', 'plan', openspecPlanSlug, 'summary.md')),
    true,
    'codex-agent should scaffold OpenSpec plan workspace in sandbox',
  );
  assert.equal(
    fs.existsSync(path.join(launchedCwd, 'openspec', 'changes', openspecChangeSlug, 'proposal.md')),
    true,
    'codex-agent should scaffold OpenSpec change proposal in sandbox',
  );
  assert.equal(
    fs.existsSync(path.join(launchedCwd, 'openspec', 'changes', openspecChangeSlug, 'tasks.md')),
    true,
    'codex-agent should scaffold OpenSpec change tasks in sandbox',
  );
  assert.equal(
    fs.existsSync(
      path.join(launchedCwd, 'openspec', 'changes', openspecChangeSlug, 'specs', 'launch-task', 'spec.md'),
    ),
    true,
    'codex-agent should scaffold OpenSpec change spec in sandbox',
  );
});

test('codex-agent restores local branch and falls back to safe worktree start when starter script switches in-place', () => {
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

  fs.writeFileSync(
    path.join(repoDir, 'scripts', 'agent-branch-start.sh'),
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'branch_name="agent/legacy/in-place-start"\n' +
      'git checkout -B "$branch_name" >/dev/null\n' +
      'echo "[agent-branch-start] Created in-place branch: ${branch_name}"\n',
    'utf8',
  );
  fs.chmodSync(path.join(repoDir, 'scripts', 'agent-branch-start.sh'), 0o755);

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-fallback-'));
  const fakeCodexPath = path.join(fakeBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${GUARDEX_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${GUARDEX_TEST_CODEX_ARGS}'}"\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd-fallback');
  const argsMarker = path.join(repoDir, '.codex-agent-args-fallback');
  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'fallback-task', 'planner', 'dev', '--model', 'gpt-5.4-mini'],
    repoDir,
    {
      PATH: `${fakeBin}:${process.env.PATH}`,
      GUARDEX_TEST_CODEX_CWD: cwdMarker,
      GUARDEX_TEST_CODEX_ARGS: argsMarker,
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  const combinedOutput = `${launch.stdout}\n${launch.stderr}`;
  assert.match(combinedOutput, /Unsafe starter output/);
  assert.match(combinedOutput, /\[agent-branch-start\] Created branch: agent\/planner\//);

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.match(
    launchedCwd,
    new RegExp(`${escapeRegexLiteral(repoDir)}/\\.omx/agent-worktrees/agent__planner__`),
  );
  assert.notEqual(launchedCwd, repoDir);
  assert.match(combinedOutput, /\[codex-agent\] OpenSpec change workspace:/);
  assert.match(combinedOutput, /\[codex-agent\] OpenSpec plan workspace:/);
  const launchedBranch = extractCreatedBranch(combinedOutput);
  const openspecPlanSlug = sanitizeSlug(launchedBranch, 'fallback-task');
  const openspecChangeSlug = sanitizeSlug(launchedBranch, 'fallback-task');
  assert.equal(
    fs.existsSync(path.join(launchedCwd, 'openspec', 'plan', openspecPlanSlug, 'summary.md')),
    true,
    'fallback sandbox path should still scaffold OpenSpec plan workspace',
  );
  assert.equal(
    fs.existsSync(path.join(launchedCwd, 'openspec', 'changes', openspecChangeSlug, 'proposal.md')),
    true,
    'fallback sandbox path should still scaffold OpenSpec change proposal',
  );

  const currentBranch = runCmd('git', ['branch', '--show-current'], repoDir);
  assert.equal(currentBranch.status, 0, currentBranch.stderr || currentBranch.stdout);
  assert.equal(currentBranch.stdout.trim(), 'dev');
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

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-bin-'));
  const fakeCodexPath = path.join(fakeBin, 'my-codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${GUARDEX_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${GUARDEX_TEST_CODEX_ARGS}'}"\n`,
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
      GUARDEX_TEST_CODEX_CWD: cwdMarker,
      GUARDEX_TEST_CODEX_ARGS: argsMarker,
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

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-dirty-'));
  const fakeCodexPath = path.join(fakeBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${GUARDEX_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${GUARDEX_TEST_CODEX_ARGS}'}"\n` +
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
      GUARDEX_TEST_CODEX_CWD: cwdMarker,
      GUARDEX_TEST_CODEX_ARGS: argsMarker,
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

test('codex-agent waits for PR merge completion and cleans merged sandbox branch/worktree by default', () => {
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

  const fakeCodexBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-autofinish-'));
  const fakeCodexPath = path.join(fakeCodexBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `pwd > "${'${GUARDEX_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${GUARDEX_TEST_CODEX_ARGS}'}"\n` +
      `echo "auto-finish-change" > codex-autofinish.txt\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const ghMergeState = path.join(repoDir, '.codex-agent-gh-merge-attempts');

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

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd-autofinish');
  const argsMarker = path.join(repoDir, '.codex-agent-args-autofinish');
  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'autofinish-task', 'planner', 'dev', '--model', 'gpt-5.4-mini'],
    repoDir,
    {
      PATH: `${fakeCodexBin}:${process.env.PATH}`,
      GUARDEX_TEST_CODEX_CWD: cwdMarker,
      GUARDEX_TEST_CODEX_ARGS: argsMarker,
      GUARDEX_TEST_GH_MERGE_STATE: ghMergeState,
      GUARDEX_GH_BIN: fakeGhPath,
      GUARDEX_FINISH_WAIT_TIMEOUT_SECONDS: '60',
      GUARDEX_FINISH_WAIT_POLL_SECONDS: '0',
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  assert.match(launch.stdout, /\[codex-agent\] Auto-finish enabled: commit -> push\/PR -> wait for merge -> cleanup\./);
  assert.match(launch.stdout, /\[codex-agent\] Auto-finish completed for/);
  assert.match(launch.stdout, /\[codex-agent\] Auto-cleaned sandbox worktree:/);
  assert.equal(fs.readFileSync(ghMergeState, 'utf8').trim(), '2', 'finish flow should retry merge until checks are ready');

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.equal(fs.existsSync(launchedCwd), false, 'auto-finished sandbox should be cleaned by default');
  const launchedBranch = extractCreatedBranch(launch.stdout);
  result = runCmd('git', ['show-ref', '--verify', '--quiet', `refs/heads/${launchedBranch}`], repoDir);
  assert.notEqual(result.status, 0, 'auto-finished branch should be removed locally by default');
  result = runCmd('git', ['ls-remote', '--heads', 'origin', launchedBranch], repoDir);
  assert.equal(result.stdout.trim(), '', 'auto-finished branch should be removed on origin by default');

  const launchedArgs = fs.readFileSync(argsMarker, 'utf8').trim();
  assert.match(launchedArgs, /--model gpt-5\.4-mini/);
});

test('codex-agent still auto-finishes when base branch advances during task run', () => {
  const repoDir = initRepo();
  seedCommit(repoDir);
  const originPath = attachOriginRemote(repoDir);

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

  result = runCmd('git', ['config', 'multiagent.sync.requireBeforeCommit', 'true'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['config', 'multiagent.sync.maxBehindCommits', '0'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const fakeCodexBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-retry-'));
  const fakeCodexPath = path.join(fakeCodexBin, 'codex');
  fs.writeFileSync(
    fakeCodexPath,
    `#!/usr/bin/env bash\n` +
      `set -e\n` +
      `pwd > "${'${GUARDEX_TEST_CODEX_CWD}'}"\n` +
      `echo "$@" > "${'${GUARDEX_TEST_CODEX_ARGS}'}"\n` +
      `echo "retry" > codex-autocommit-retry.txt\n` +
      `clone_dir="${'${GUARDEX_TEST_ORIGIN_ADVANCE_CLONE}'}"\n` +
      `rm -rf "$clone_dir"\n` +
      `git clone "${'${GUARDEX_TEST_ORIGIN_PATH}'}" "$clone_dir" >/dev/null 2>&1\n` +
      `git -C "$clone_dir" config user.email "bot@example.com"\n` +
      `git -C "$clone_dir" config user.name "Bot"\n` +
      `git -C "$clone_dir" checkout dev >/dev/null 2>&1\n` +
      `echo "advance base" > "$clone_dir/base-advance.txt"\n` +
      `git -C "$clone_dir" add base-advance.txt\n` +
      `git -C "$clone_dir" commit -m "advance base during codex run" >/dev/null 2>&1\n` +
      `git -C "$clone_dir" push origin dev >/dev/null 2>&1\n`,
    'utf8',
  );
  fs.chmodSync(fakeCodexPath, 0o755);

  const { fakePath: fakeGhPath } = createFakeGhScript(`
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  exit 0
fi
if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ " $* " == *" --json state,mergedAt,url "* ]]; then
    printf 'MERGED\\x1f2026-04-13T00:00:00Z\\x1fhttps://example.test/pr/autocommit-retry\\n'
    exit 0
  fi
  if [[ " $* " == *" --json url "* ]]; then
    echo "https://example.test/pr/autocommit-retry"
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

  const cwdMarker = path.join(repoDir, '.codex-agent-cwd-autocommit-retry');
  const argsMarker = path.join(repoDir, '.codex-agent-args-autocommit-retry');
  const originAdvanceClone = path.join(repoDir, '.origin-advance-clone');
  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'autocommit-retry-task', 'planner', 'dev', '--model', 'gpt-5.4-mini'],
    repoDir,
    {
      PATH: `${fakeCodexBin}:${process.env.PATH}`,
      GUARDEX_TEST_CODEX_CWD: cwdMarker,
      GUARDEX_TEST_CODEX_ARGS: argsMarker,
      GUARDEX_TEST_ORIGIN_PATH: originPath,
      GUARDEX_TEST_ORIGIN_ADVANCE_CLONE: originAdvanceClone,
      GUARDEX_GH_BIN: fakeGhPath,
      GUARDEX_FINISH_WAIT_TIMEOUT_SECONDS: '60',
      GUARDEX_FINISH_WAIT_POLL_SECONDS: '0',
    },
  );
  assert.equal(launch.status, 0, launch.stderr || launch.stdout);
  const sawCommitRetry = /Auto-commit retry: .*behind origin\/dev/.test(launch.stdout);
  const sawFinishSync = /\[agent-sync-guard\] Auto-syncing .* onto origin\/dev before finish/.test(launch.stdout);
  assert.equal(
    sawCommitRetry || sawFinishSync,
    true,
    `expected sync retry evidence in output, got:\n${launch.stdout}`,
  );
  assert.match(launch.stdout, /\[codex-agent\] Auto-finish completed for/);
  assert.match(launch.stdout, /\[codex-agent\] Auto-cleaned sandbox worktree:/);

  const launchedCwd = fs.readFileSync(cwdMarker, 'utf8').trim();
  assert.equal(fs.existsSync(launchedCwd), false, 'auto-finished sandbox should be cleaned by default');
});

test('codex-agent surfaces commit-hook failures so unfinished sandboxes are actionable', () => {
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

  fs.writeFileSync(
    path.join(repoDir, '.githooks', 'pre-commit'),
    '#!/usr/bin/env bash\nset -euo pipefail\necho "forced pre-commit failure for test" >&2\nexit 1\n',
    'utf8',
  );
  fs.chmodSync(path.join(repoDir, '.githooks', 'pre-commit'), 0o755);
  result = runCmd('git', ['config', 'core.hooksPath', `${repoDir}/.githooks`], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const fakeCodexBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-codex-hookfail-'));
  const fakeCodexPath = path.join(fakeCodexBin, 'codex');
  fs.writeFileSync(fakeCodexPath, '#!/usr/bin/env bash\nset -e\necho "hook-fail" > codex-hook-fail.txt\n', 'utf8');
  fs.chmodSync(fakeCodexPath, 0o755);

  const launch = runCmd(
    'bash',
    ['scripts/codex-agent.sh', 'hook-fail-task', 'planner', 'dev'],
    repoDir,
    {
      PATH: `${fakeCodexBin}:${process.env.PATH}`,
      GUARDEX_CODEX_WAIT_FOR_MERGE: 'false',
      GUARDEX_FINISH_WAIT_TIMEOUT_SECONDS: '30',
      GUARDEX_FINISH_WAIT_POLL_SECONDS: '0',
    },
  );
  assert.notEqual(launch.status, 0, launch.stderr || launch.stdout);
  assert.match(launch.stderr, /Auto-commit failed in sandbox/);
  assert.match(launch.stderr, /forced pre-commit failure for test/);
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

  const finish = runCmd(
    'bash',
    [
      path.join(repoDir, 'scripts', 'agent-branch-finish.sh'),
      '--branch',
      'agent/test-active-worktree-cleanup',
      '--base',
      'dev',
      '--mode',
      'pr',
      '--cleanup',
    ],
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

  const finish = runCmd(
    'bash',
    [
      'scripts/agent-branch-finish.sh',
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

test('OpenSpec change workspace scaffold creates proposal/tasks/spec defaults', () => {
  const repoDir = initRepo();

  const setupResult = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(setupResult.status, 0, setupResult.stderr || setupResult.stdout);

  const changeSlug = 'change-workspace-smoke';
  const capabilitySlug = 'runtime-migration';
  const scaffold = runCmd(
    'bash',
    ['scripts/openspec/init-change-workspace.sh', changeSlug, capabilitySlug],
    repoDir,
  );
  assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);

  const changeDir = path.join(repoDir, 'openspec', 'changes', changeSlug);
  assert.equal(fs.existsSync(path.join(changeDir, '.openspec.yaml')), true, '.openspec.yaml missing');
  assert.equal(fs.existsSync(path.join(changeDir, 'proposal.md')), true, 'proposal.md missing');
  assert.equal(fs.existsSync(path.join(changeDir, 'tasks.md')), true, 'tasks.md missing');
  assert.equal(fs.existsSync(path.join(changeDir, 'specs', capabilitySlug, 'spec.md')), true, 'spec.md missing');
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
  fs.rmSync(path.join(repoDir, '.omx', 'notepad.md'));
  fs.rmSync(path.join(repoDir, '.omx', 'project-memory.json'));
  fs.rmSync(path.join(repoDir, '.omx', 'logs'), { recursive: true, force: true });
  fs.rmSync(path.join(repoDir, '.omx', 'plans'), { recursive: true, force: true });
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
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'notepad.md')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'project-memory.json')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'logs')), true);
  assert.equal(fs.existsSync(path.join(repoDir, '.omx', 'plans')), true);

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
  assert.match(result.stdout, /OpenSpec default change flow \(core profile\)/);
  assert.match(result.stdout, /\/opsx:propose <change-name>/);
  assert.match(result.stdout, /openspec config profile <profile-name>/);
  assert.match(result.stdout, /fork sync with Pull app/);
  assert.match(result.stdout, /https:\/\/github.com\/apps\/pull/);
  assert.match(result.stdout, /https:\/\/github.com\/apps\/cr-gpt/);
  assert.match(result.stdout, /OPENAI_API_KEY/);
  assert.match(result.stdout, /\.github\/workflows\/cr\.yml/);
  assert.match(result.stdout, /scripts\/agent-file-locks.py claim/);
  assert.match(result.stdout, /For every new user message\/task, repeat the same cycle/);
});

test('copy-commands outputs command-only checklist', () => {
  const repoDir = initRepo();
  const result = runNode(['copy-commands'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^npm i -g @imdeadpool\/guardex/m);
  assert.match(result.stdout, /^gh --version/m);
  assert.match(result.stdout, /gx setup/);
  assert.match(result.stdout, /gx doctor/);
  assert.match(result.stdout, /scripts\/agent-file-locks.py claim/);
  assert.match(result.stdout, /^openspec config profile <profile-name>$/m);
  assert.match(result.stdout, /^openspec update$/m);
  assert.match(result.stdout, /^cp \.github\/pull\.yml\.example \.github\/pull\.yml$/m);
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
    GUARDEX_NPM_BIN: fakeNpm,
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
    GUARDEX_NPM_BIN: fakeNpm,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(marker), true, 'global install should run for missing package');
  const args = fs.readFileSync(marker, 'utf8').trim();
  assert.equal(args, 'i -g @fission-ai/openspec @imdeadpool/codex-account-switcher');
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

test('setup warns when gh dependency is missing', () => {
  const repoDir = initRepo();
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "list" ]]; then
  cat <<'JSON'
{"dependencies":{"oh-my-codex":{"version":"1.0.0"},"@fission-ai/openspec":{"version":"1.0.0"},"@imdeadpool/codex-account-switcher":{"version":"1.0.0"}}}
JSON
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const result = runNodeWithEnv(['setup', '--target', repoDir, '--yes-global-install'], repoDir, {
    GUARDEX_NPM_BIN: fakeNpm,
    GUARDEX_GH_BIN: 'gh-command-not-found-for-test',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Missing required system tool\(s\): gh/);
  assert.match(result.stdout, /https:\/\/cli\.github\.com\//);
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

test('worktree prune --only-dirty-worktrees removes clean agent worktrees but keeps unmerged branch refs', () => {
  const repoDir = initRepo();
  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__test-clean-worktree-prune');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-clean-worktree-prune', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(worktreePath, 'unmerged.txt'), 'keep branch, drop clean worktree\n', 'utf8');
  result = runCmd('git', ['-C', worktreePath, 'add', 'unmerged.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['-C', worktreePath, 'commit', '-m', 'unmerged clean worktree commit'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh', '--only-dirty-worktrees'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), false, 'clean agent worktree should be removed');

  const branchResult = runCmd('git', ['show-ref', '--verify', '--quiet', 'refs/heads/agent/test-clean-worktree-prune'], repoDir);
  assert.equal(branchResult.status, 0, 'unmerged branch ref should remain');
});

test('worktree prune reroutes foreign worktrees to the owning repo .omx root', () => {
  const repoDir = initRepo();
  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const foreignRepoDir = initRepo();
  seedCommit(foreignRepoDir);

  const misplacedPath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__foreign-owned');
  result = runCmd(
    'git',
    ['-C', foreignRepoDir, 'worktree', 'add', '-b', 'agent/foreign-owned', misplacedPath, 'dev'],
    repoDir,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(misplacedPath), true, 'foreign worktree should start misplaced under current repo');

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Relocating foreign worktree to owning repo/);
  assert.equal(fs.existsSync(misplacedPath), false, 'misplaced foreign worktree should be moved out');

  const foreignWorktreeRoot = path.join(foreignRepoDir, '.omx', 'agent-worktrees');
  const relocatedCandidates = fs.existsSync(foreignWorktreeRoot)
    ? fs.readdirSync(foreignWorktreeRoot).filter((name) => name.startsWith('agent__foreign-owned'))
    : [];
  assert.equal(relocatedCandidates.length > 0, true, 'foreign repo should receive relocated worktree');

  const relocatedPath = path.join(foreignWorktreeRoot, relocatedCandidates[0]);
  const commonDirResult = runCmd('git', ['-C', relocatedPath, 'rev-parse', '--git-common-dir'], repoDir);
  assert.equal(commonDirResult.status, 0, commonDirResult.stderr || commonDirResult.stdout);
  assert.match(commonDirResult.stdout.trim(), new RegExp(`${escapeRegexLiteral(foreignRepoDir)}/\\.git$`));
});

test('worktree prune --idle-minutes preserves recent branch activity and prunes stale idle branches', () => {
  const repoDir = initRepo();
  let result = runNode(['setup', '--target', repoDir, '--no-global-install'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  seedCommit(repoDir);

  const worktreePath = path.join(repoDir, '.omx', 'agent-worktrees', 'agent__idle-threshold');
  result = runCmd('git', ['worktree', 'add', '-b', 'agent/test-idle-threshold', worktreePath, 'dev'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  fs.writeFileSync(path.join(worktreePath, 'idle-threshold.txt'), 'idle threshold branch commit\n', 'utf8');
  result = runCmd('git', ['-C', worktreePath, 'add', 'idle-threshold.txt'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  result = runCmd('git', ['-C', worktreePath, 'commit', '-m', 'idle threshold branch commit'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  result = runCmd('bash', ['scripts/agent-worktree-prune.sh', '--only-dirty-worktrees', '--idle-minutes', '10'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), true, 'recent branch should remain inside idle threshold');

  const fakeNowEpoch = Math.floor(Date.now() / 1000) + 3600;
  result = runCmd(
    'bash',
    ['scripts/agent-worktree-prune.sh', '--only-dirty-worktrees', '--idle-minutes', '10'],
    repoDir,
    {
      GUARDEX_PRUNE_NOW_EPOCH: String(fakeNowEpoch),
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(worktreePath), false, 'idle branch should be pruned after threshold is exceeded');
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
  const scriptsDir = path.join(repoDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const pruneScriptPath = path.join(scriptsDir, 'agent-worktree-prune.sh');
  const markerArgs = path.join(repoDir, '.cleanup-watch-args');
  fs.writeFileSync(
    pruneScriptPath,
    '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      `printf '%s\\n' \"$*\" > \"${markerArgs}\"\n`,
    'utf8',
  );
  fs.chmodSync(pruneScriptPath, 0o755);

  const result = runNode(['cleanup', '--target', repoDir, '--watch', '--once', '--interval', '15'], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const passedArgs = fs.readFileSync(markerArgs, 'utf8').trim();
  assert.match(passedArgs, /--idle-minutes 60/);
  assert.match(passedArgs, /--only-dirty-worktrees/);
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
    GUARDEX_RELEASE_REPO: repoDir,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /required: 'main'/);
});

test('release fails when git status is dirty', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  fs.writeFileSync(path.join(repoDir, 'dirty.txt'), 'dirty\n');
  const result = runNodeWithEnv(['release'], repoDir, {
    GUARDEX_RELEASE_REPO: repoDir,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /working tree is not clean/);
});

test('release runs npm publish when guardrails pass', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);

  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-bin-'));
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
    GUARDEX_RELEASE_REPO: repoDir,
    PATH: `${fakeBin}:${process.env.PATH}`,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const args = fs.readFileSync(markerPath, 'utf8').trim();
  assert.equal(args, 'publish');
});

test('typo helper maps relaese/realaese to release', () => {
  const repoDir = initRepoOnBranch('main');
  seedCommit(repoDir);
  const marker = path.join(os.tmpdir(), `guardex-typo-publish-${Date.now()}-${Math.random()}.txt`);
  const fakeNpm = createFakeNpmScript(`
if [[ "$1" == "publish" ]]; then
  echo "$@" > "${marker}"
  exit 0
fi
echo "unexpected npm args: $*" >&2
exit 1
`);

  const typoA = runNodeWithEnv(['relaese'], repoDir, {
    GUARDEX_RELEASE_REPO: repoDir,
    GUARDEX_NPM_BIN: fakeNpm,
  });
  assert.equal(typoA.status, 0, typoA.stderr || typoA.stdout);
  assert.match(typoA.stdout, /Interpreting 'relaese' as 'release'/);
  assert.equal(fs.readFileSync(marker, 'utf8').trim(), 'publish');

  const typoB = runNodeWithEnv(['realaese'], repoDir, {
    GUARDEX_RELEASE_REPO: repoDir,
    GUARDEX_NPM_BIN: fakeNpm,
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

}
