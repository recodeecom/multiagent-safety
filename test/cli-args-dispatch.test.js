const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES,
  MANAGED_GITIGNORE_PATHS,
  CLI_COMMAND_DESCRIPTIONS,
  MAINTAINER_RELEASE_REPO,
  toDestinationPath,
} = require('../src/context');
const scaffold = require('../src/scaffold');
const {
  parseSetupArgs,
  parseDoctorArgs,
  parseAgentsArgs,
  parseCleanupArgs,
  parseMergeArgs,
  parseFinishArgs,
} = require('../src/cli/args');
const {
  maybeSuggestCommand,
  normalizeCommandOrThrow,
  warnDeprecatedAlias,
  extractFlag,
} = require('../src/cli/dispatch');

const repoRoot = path.resolve(__dirname, '..');

function captureConsole(methodName, fn) {
  const original = console[methodName];
  const calls = [];
  console[methodName] = (...args) => {
    calls.push(args.join(' '));
  };

  try {
    return { result: fn(), calls };
  } finally {
    console[methodName] = original;
  }
}

test('parseDoctorArgs keeps doctor-specific flags while reusing repo traversal parsing', () => {
  const options = parseDoctorArgs([
    '--current',
    '--force',
    'AGENTS.md',
    '.gitignore',
    '--verbose-auto-finish',
    '--skip-package-json',
    '--no-gitignore',
  ]);

  assert.equal(options.target, process.cwd());
  assert.equal(options.recursive, false);
  assert.equal(options.force, true);
  assert.deepEqual(options.forceManagedPaths, ['AGENTS.md', '.gitignore']);
  assert.equal(options.verboseAutoFinish, true);
  assert.equal(options.skipPackageJson, true);
  assert.equal(options.skipGitignore, true);
  assert.equal(options.waitForMerge, true);
});

test('parseSetupArgs keeps nested traversal and parent workspace view flags', () => {
  const options = parseSetupArgs([
    '--target',
    '/tmp/guardex-repo',
    '--no-recursive',
    '--max-depth',
    '4',
    '--skip-nested',
    'vendor',
    '--include-submodules',
    '--parent-workspace-view',
  ], {
    force: false,
    dryRun: false,
    dropStaleLocks: true,
  });

  assert.equal(options.target, '/tmp/guardex-repo');
  assert.equal(options.recursive, false);
  assert.equal(options.nestedMaxDepth, 4);
  assert.deepEqual(options.nestedSkipDirs, ['vendor']);
  assert.equal(options.includeSubmodules, true);
  assert.equal(options.parentWorkspaceView, true);
});

test('parseAgentsArgs applies interval overrides and validates the subcommand', () => {
  const options = parseAgentsArgs([
    'start',
    '--target',
    '/tmp/guardex-repo',
    '--review-interval',
    '15',
    '--cleanup-interval',
    '45',
    '--idle-minutes',
    '12',
  ]);

  assert.deepEqual(options, {
    target: '/tmp/guardex-repo',
    subcommand: 'start',
    reviewIntervalSeconds: 15,
    cleanupIntervalSeconds: 45,
    idleMinutes: 12,
  });
});

test('parseCleanupArgs defaults idle minutes when watch mode is enabled', () => {
  const options = parseCleanupArgs(['--watch']);
  assert.equal(options.watch, true);
  assert.equal(options.idleMinutes, DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES);
});

test('parseMergeArgs requires at least one agent branch', () => {
  assert.throws(
    () => parseMergeArgs(['--base', 'dev']),
    /merge requires at least one --branch <agent\/\*> input/,
  );
});

test('parseFinishArgs rejects non-agent branches and preserves explicit overrides', () => {
  assert.throws(
    () => parseFinishArgs(['--branch', 'feature/not-agent']),
    /--branch must reference an agent\/\* branch/,
  );

  const options = parseFinishArgs([
    '--branch',
    'agent/codex/example',
    '--no-cleanup',
    '--no-wait-for-merge',
    '--direct-only',
    '--keep-remote',
    '--no-auto-commit',
    '--fail-fast',
    '--commit-message',
    'Finish the active lane',
  ]);

  assert.equal(options.branch, 'agent/codex/example');
  assert.equal(options.cleanup, false);
  assert.equal(options.waitForMerge, false);
  assert.equal(options.mergeMode, 'direct');
  assert.equal(options.keepRemote, true);
  assert.equal(options.noAutoCommit, true);
  assert.equal(options.failFast, true);
  assert.equal(options.commitMessage, 'Finish the active lane');
});

test('dispatch helpers preserve suggestion, alias, deprecation, and flag extraction behavior', () => {
  assert.equal(maybeSuggestCommand('docto'), 'doctor');

  const alias = captureConsole('log', () => normalizeCommandOrThrow('doctro'));
  assert.equal(alias.result, 'doctor');
  assert.match(alias.calls.join('\n'), /\[gitguardex\] Interpreting 'doctro' as 'doctor'\./);

  const deprecation = captureConsole('error', () => warnDeprecatedAlias('init'));
  assert.match(deprecation.calls.join('\n'), /\[gitguardex\] 'init' is deprecated/);
  assert.match(deprecation.calls.join('\n'), /gx setup/);

  assert.deepEqual(
    extractFlag(['status', '--strict', '--json'], '--strict'),
    { found: true, remaining: ['status', '--json'] },
  );
});

test('shared context keeps the drift-prone help text, gitignore paths, and release repo root', () => {
  const descriptions = new Map(CLI_COMMAND_DESCRIPTIONS);

  assert.match(descriptions.get('setup'), /--current/);
  assert.match(descriptions.get('doctor'), /--current/);
  assert.ok(MANAGED_GITIGNORE_PATHS.includes('!.vscode/'));
  assert.ok(MANAGED_GITIGNORE_PATHS.includes('.vscode/*'));
  assert.ok(MANAGED_GITIGNORE_PATHS.includes('!.vscode/settings.json'));
  assert.equal(MAINTAINER_RELEASE_REPO, repoRoot);
});

test('scaffold reuses the shared destination-path helper from context', () => {
  assert.equal(scaffold.toDestinationPath, toDestinationPath);
  assert.equal(scaffold.toDestinationPath('github/pull.yml.example'), '.github/pull.yml.example');
});

test('cli main no longer keeps local copies of extracted shared helpers or dead cleanup code', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'cli', 'main.js'), 'utf8');

  assert.match(source, /require\('\.\.\/context'\)/);
  assert.match(source, /require\('\.\.\/output'\)/);
  assert.match(source, /require\('\.\.\/scaffold'\)/);
  assert.match(source, /require\('\.\/args'\)/);
  assert.match(source, /require\('\.\/dispatch'\)/);
  assert.match(source, /require\('\.\.\/git'\)/);
  assert.doesNotMatch(source, /const TOOL_NAME = 'gitguardex';/);
  assert.doesNotMatch(source, /const MAINTAINER_RELEASE_REPO = path\.resolve\(/);
  assert.doesNotMatch(source, /function envFlagIsTruthy\(raw\)/);
  assert.doesNotMatch(source, /function isClaudeCodeSession\(env = process\.env\)/);
  assert.doesNotMatch(source, /function defaultAgentWorktreeRelativeDir\(env = process\.env\)/);
  assert.doesNotMatch(source, /function parseDoctorArgs\(rawArgs\)/);
  assert.doesNotMatch(source, /function parseSetupArgs\(rawArgs, defaults\)/);
  assert.doesNotMatch(source, /function parseCleanupArgs\(rawArgs\)/);
  assert.doesNotMatch(source, /function parseFinishArgs\(rawArgs, defaults = \{\}\)/);
  assert.doesNotMatch(source, /function gitRun\(repoRoot, args, \{ allowFailure = false \} = \{\}\)/);
  assert.doesNotMatch(source, /function resolveRepoRoot\(targetPath\)/);
  assert.doesNotMatch(source, /function isGitRepo\(targetPath\)/);
  assert.doesNotMatch(source, /function discoverNestedGitRepos\(rootPath, opts = \{\}\)/);
  assert.doesNotMatch(source, /function maybeSuggestCommand\(command\)/);
  assert.doesNotMatch(source, /function normalizeCommandOrThrow\(command\)/);
  assert.doesNotMatch(source, /function warnDeprecatedAlias\(aliasName\)/);
  assert.doesNotMatch(source, /function extractFlag\(args, \.\.\.names\)/);
  assert.doesNotMatch(source, /function runtimeVersion\(\)/);
  assert.doesNotMatch(source, /function usage\(options = \{\}\)/);
  assert.doesNotMatch(source, /function toDestinationPath\(relativeTemplatePath\)/);
  assert.doesNotMatch(source, /function printOperations\(title, payload, dryRun = false\)/);
  assert.doesNotMatch(source, /function printStandaloneOperations\(title, rootLabel, operations, dryRun = false\)/);
  assert.doesNotMatch(source, /function promptYesNo\(question, defaultYes = true\)/);
  assert.doesNotMatch(source, /function envFlagEnabled\(name\)/);
  assert.doesNotMatch(source, /function installMany\(rawArgs\)/);
  assert.doesNotMatch(source, /function initWorkspace\(rawArgs\)/);
  assert.doesNotMatch(source, /function doctorAudit\(rawArgs\)/);
  assert.doesNotMatch(source, /function syncDoctorLocalSupportFiles\(repoRoot, dryRun\)/);
  assert.equal((source.match(/function gitRefExists\(/g) || []).length, 1);
  assert.equal((source.match(/Auto-finish flow failed for sandbox branch/g) || []).length, 1);
});
