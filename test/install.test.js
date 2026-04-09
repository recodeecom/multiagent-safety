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

function runCmd(cmd, args, cwd) {
  return cp.spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
  });
}

function createFakeNpmScript(scriptBody) {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'musafety-fake-npm-'));
  const fakeNpmPath = path.join(fakeBin, 'npm');
  fs.writeFileSync(fakeNpmPath, `#!/usr/bin/env bash\nset -e\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(fakeNpmPath, 0o755);
  return fakeNpmPath;
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

test('setup provisions workflow files and repo config', () => {
  const repoDir = initRepo();

  let result = runNode(['setup', '--target', repoDir], repoDir);
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
  assert.equal(packageJson.scripts['agent:safety:setup'], 'musafety setup');

  const agentsContent = fs.readFileSync(path.join(repoDir, 'AGENTS.md'), 'utf8');
  assert.equal(agentsContent.includes('<!-- multiagent-safety:START -->'), true);

  result = runCmd('git', ['config', '--get', 'core.hooksPath'], repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '.githooks');

  const secondRun = runNode(['setup', '--target', repoDir], repoDir);
  assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);
});

test('default invocation runs setup', () => {
  const repoDir = initRepo();

  const result = runNode([], repoDir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(repoDir, '.githooks', 'pre-commit')), true);
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
