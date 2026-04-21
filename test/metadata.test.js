const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const readmePath = path.join(repoRoot, 'README.md');

function escapeRegexLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('package manifest includes repository and support metadata', () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert.equal(pkg.repository?.url, 'git+https://github.com/recodeee/gitguardex.git');
  assert.equal(pkg.bugs?.url, 'https://github.com/recodeee/gitguardex/issues');
  assert.equal(pkg.homepage, 'https://github.com/recodeee/gitguardex-frontend');
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

test('release workflow skips publish when the current version is already on npm', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /name:\s+Resolve package metadata/);
  assert.match(workflow, /name:\s+Check npm registry for current version/);
  assert.match(workflow, /npm view "\$\{PACKAGE_NAME\}@\$\{PACKAGE_VERSION\}" version/);
  assert.match(workflow, /if:\s+\$\{\{\s*steps\.registry\.outputs\.already_published != 'true'\s*\}\}/);
  assert.match(workflow, /if:\s+\$\{\{\s*steps\.registry\.outputs\.already_published == 'true'\s*\}\}/);
  assert.match(workflow, /skipping publish\./);
});

test('release workflow only publishes from published releases or manual dispatch', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /release:\s*\n\s*types:\s*\[published\]/);
  assert.doesNotMatch(workflow, /\npush:\s*\n/);
});

test('README release notes include current package version', () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  const headingPattern = new RegExp(`^###\\s+v${escapeRegexLiteral(pkg.version)}\\b`, 'm');
  assert.match(
    readme,
    headingPattern,
    `README release notes must include heading for v${pkg.version}`,
  );
});

test('README documents gx release as README-driven GitHub release writer', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');
  assert.match(readme, /gx release\s+# create\/update the current GitHub release from README notes/);
  assert.match(readme, /`gx release` is the maintainer path for package releases\./);
  assert.match(readme, /finds the last published GitHub release, and writes one grouped GitHub release body/);
});

test('security workflows are present and use pinned GitHub Actions SHAs', () => {
  const workflowDir = path.join(repoRoot, '.github', 'workflows');
  const expected = ['ci.yml', 'release.yml', 'scorecard.yml', 'codeql.yml', 'cr.yml'];
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

test('code review workflow does not gate startup on secrets context', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'cr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /if:\s+\$\{\{\s*secrets\.OPENAI_API_KEY/);
  assert.match(workflow, /OPENAI_API_KEY:\s+\$\{\{\s*secrets\.OPENAI_API_KEY\s*\}\}/);
  assert.match(workflow, /if:\s+\$\{\{\s*env\.OPENAI_API_KEY != ''\s*\}\}/);
});

test('frontend mirror workflow skips cleanly when the mirror PAT is missing', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'sync-frontend-mirror.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /if:\s+\$\{\{\s*secrets\.GUARDEX_FRONTEND_MIRROR_PAT/);
  assert.match(workflow, /SYNC_TOKEN:\s+\$\{\{\s*secrets\.GUARDEX_FRONTEND_MIRROR_PAT\s*\}\}/);
  assert.match(workflow, /name:\s+Skip when mirror PAT is missing/);
  assert.match(workflow, /if:\s+\$\{\{\s*env\.SYNC_TOKEN == ''\s*\}\}/);
  assert.match(workflow, /if:\s+\$\{\{\s*env\.SYNC_TOKEN != ''\s*\}\}/);
});

test('critical runtime helper scripts stay in sync with templates', () => {
  const pairs = [
    ['templates/scripts/agent-branch-start.sh', 'scripts/agent-branch-start.sh'],
    ['templates/scripts/codex-agent.sh', 'scripts/codex-agent.sh'],
    ['templates/scripts/openspec/init-plan-workspace.sh', 'scripts/openspec/init-plan-workspace.sh'],
    ['templates/scripts/openspec/init-change-workspace.sh', 'scripts/openspec/init-change-workspace.sh'],
  ];

  for (const [templatePath, runtimePath] of pairs) {
    const template = fs.readFileSync(path.join(repoRoot, templatePath), 'utf8');
    const runtime = fs.readFileSync(path.join(repoRoot, runtimePath), 'utf8');
    assert.equal(
      runtime,
      template,
      `${runtimePath} diverged from ${templatePath}; run gx setup/doctor parity repair`,
    );
  }
});

test('doctor CLI parser exists to prevent runtime ReferenceError regressions', () => {
  const cliPath = path.join(repoRoot, 'bin', 'multiagent-safety.js');
  const cliSource = fs.readFileSync(cliPath, 'utf8');
  assert.match(cliSource, /function parseDoctorArgs\(rawArgs\)/);
  assert.match(cliSource, /function doctorAudit\(rawArgs\)/);
});

test('active doctor command remains single-source and runs the repair-first path', () => {
  const cliPath = path.join(repoRoot, 'bin', 'multiagent-safety.js');
  const cliSource = fs.readFileSync(cliPath, 'utf8');
  const doctorDefs = cliSource.match(/function doctor\(rawArgs\)/g) || [];
  assert.equal(doctorDefs.length, 1, 'doctor() must not be duplicated');
  assert.match(cliSource, /printOperations\('Doctor\/fix', fixPayload, (?:singleRepoOptions|options)\.dryRun\);/);
});

test('worktree-change detection uses normal untracked-file mode', () => {
  const cliPath = path.join(repoRoot, 'bin', 'multiagent-safety.js');
  const cliSource = fs.readFileSync(cliPath, 'utf8');
  assert.match(cliSource, /'status',\s*'--porcelain',\s*'--untracked-files=normal',\s*'--'/s);
});
