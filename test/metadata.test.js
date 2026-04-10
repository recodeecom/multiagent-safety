const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

test('package manifest includes repository and support metadata', () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert.equal(pkg.repository?.url, 'git+https://github.com/recodeecom/multiagent-safety.git');
  assert.equal(pkg.bugs?.url, 'https://github.com/recodeecom/multiagent-safety/issues');
  assert.equal(pkg.homepage, 'https://github.com/recodeecom/multiagent-safety#readme');
  assert.equal(pkg.publishConfig?.access, 'public');
});

test('security and contribution docs exist', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'SECURITY.md')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, 'CONTRIBUTING.md')), true);
});

test('release workflow publishes with provenance in CI', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /npm publish --provenance --access public/);
});

test('security workflows are present and use pinned GitHub Actions SHAs', () => {
  const workflowDir = path.join(repoRoot, '.github', 'workflows');
  const expected = ['ci.yml', 'release.yml', 'scorecard.yml', 'codeql.yml'];
  for (const file of expected) {
    const filePath = path.join(workflowDir, file);
    assert.equal(fs.existsSync(filePath), true, `${file} missing`);
    const content = fs.readFileSync(filePath, 'utf8');
    const usesLines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('uses: '));
    for (const line of usesLines) {
      assert.match(line, /^uses:\s+\S+@[0-9a-f]{40}(\s+#.+)?$/, `${file} has unpinned action: ${line}`);
    }
  }
});
