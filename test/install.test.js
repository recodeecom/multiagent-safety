const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const cliPath = path.resolve(__dirname, '..', 'bin', 'multiagent-safety.js');

function runNode(args, cwd) {
  return cp.spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function runCmd(cmd, args, cwd) {
  return cp.spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
  });
}

function initRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiagent-safety-'));
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

test('install provisions workflow files and repo config', () => {
  const repoDir = initRepo();

  let result = runNode(['install', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const requiredFiles = [
    'scripts/agent-branch-start.sh',
    'scripts/agent-branch-finish.sh',
    'scripts/agent-file-locks.py',
    'scripts/install-agent-git-hooks.sh',
    '.githooks/pre-commit',
    '.omx/state/agent-file-locks.json',
    'AGENTS.md',
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(fs.existsSync(path.join(repoDir, relativePath)), true, `${relativePath} missing`);
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['agent:branch:start'], 'bash ./scripts/agent-branch-start.sh');
  assert.equal(
    packageJson.scripts['agent:locks:allow-delete'],
    'python3 ./scripts/agent-file-locks.py allow-delete',
  );

  const agentsContent = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(agentsContent.includes('<!-- multiagent-safety:START -->'), true);

  result = runCmd('git', ['config', '--get', 'core.hooksPath'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '.githooks');

  const secondRun = runNode(['install', '--target', repoDir], repoDir);
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);

  const scanRun = runNode(['scan', '--target', repoDir], repoDir);
  assert.equal(scanRun.status, 0, scanRun.stdout + scanRun.stderr);
});

test('validate blocks unapproved deletions until allow-delete is set', () => {
  const repoDir = initRepo();

  let result = runNode(['install', '--target', repoDir], repoDir);
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

test('scan reports stale lock warnings in json mode', () => {
  const repoDir = initRepo();

  let result = runNode(['install', '--target', repoDir], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

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

  result = runNode(['scan', '--target', repoDir, '--json'], repoDir);
  assert.equal(result.status, 1, 'stale lock should produce warning exit code 1');

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.errors, 0);
  assert.ok(payload.warnings >= 1);
  assert.ok(payload.findings.some((item) => item.code === 'stale-branch-lock'));
  assert.ok(payload.findings.some((item) => item.code === 'lock-target-missing'));
});
