#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const TOOL_NAME = 'musafety';
const LEGACY_NAME = 'multiagent-safety';
const GLOBAL_TOOLCHAIN_PACKAGES = ['oh-my-codex', '@fission-ai/openspec'];
const MAINTAINER_RELEASE_REPO = path.resolve(
  process.env.MUSAFETY_RELEASE_REPO || '/tmp/multiagent-safety',
);
const NPM_BIN = process.env.MUSAFETY_NPM_BIN || 'npm';

const TEMPLATE_ROOT = path.resolve(__dirname, '..', 'templates');

const TEMPLATE_FILES = [
  'scripts/agent-branch-start.sh',
  'scripts/agent-branch-finish.sh',
  'scripts/agent-file-locks.py',
  'scripts/install-agent-git-hooks.sh',
  'githooks/pre-commit',
];

const EXECUTABLE_RELATIVE_PATHS = new Set([
  'scripts/agent-branch-start.sh',
  'scripts/agent-branch-finish.sh',
  'scripts/agent-file-locks.py',
  'scripts/install-agent-git-hooks.sh',
  '.githooks/pre-commit',
]);

const CRITICAL_GUARDRAIL_PATHS = new Set([
  'AGENTS.md',
  '.githooks/pre-commit',
  'scripts/agent-branch-start.sh',
  'scripts/agent-branch-finish.sh',
  'scripts/agent-file-locks.py',
]);

const LOCK_FILE_RELATIVE = '.omx/state/agent-file-locks.json';
const AGENTS_MARKER_START = '<!-- multiagent-safety:START -->';
const COMMAND_TYPO_ALIASES = new Map([
  ['relaese', 'release'],
  ['realaese', 'release'],
  ['relase', 'release'],
  ['setpu', 'setup'],
  ['intsall', 'install'],
  ['scna', 'scan'],
]);
const SUGGESTIBLE_COMMANDS = [
  'setup',
  'copy-prompt',
  'release',
  'install',
  'fix',
  'scan',
  'print-agents-snippet',
  'help',
  'version',
];

const AI_SETUP_PROMPT = `Use this exact checklist to setup multi-agent safety in this repository for Codex or Claude.

1) Install (if missing):
   npm i -g musafety

2) Bootstrap safety in this repo:
   musafety setup

   - Setup detects global OMX/OpenSpec first.
   - If one is missing and setup asks for approval, reply explicitly:
     - y = run: npm i -g oh-my-codex @fission-ai/openspec (missing ones only)
     - n = skip global installs

3) If setup reports warnings/errors, repair + re-check:
   musafety fix
   musafety scan

4) Confirm next safe agent workflow commands:
   bash scripts/agent-branch-start.sh "task" "agent-name"
   python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
   bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
`;

function usage() {
  console.log(`${TOOL_NAME} v${packageJson.version}

Simple usage (recommended):
  ${TOOL_NAME} setup [--target <path>] [--dry-run] [--yes-global-install|--no-global-install]
  ${TOOL_NAME} copy-prompt
  ${TOOL_NAME} release

Advanced:
  ${TOOL_NAME} install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--dry-run]
  ${TOOL_NAME} fix [--target <path>] [--dry-run] [--keep-stale-locks] [--skip-agents] [--skip-package-json]
  ${TOOL_NAME} scan [--target <path>] [--json]

Notes:
  - Running ${TOOL_NAME} with no command defaults to: ${TOOL_NAME} setup
  - ${TOOL_NAME} setup asks for Y/N approval before global installs
  - ${LEGACY_NAME} command name is still supported as an alias`);
}

function run(cmd, args, options = {}) {
  return cp.spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    cwd: options.cwd,
  });
}

function gitRun(repoRoot, args, { allowFailure = false } = {}) {
  const result = run('git', ['-C', repoRoot, ...args]);
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  }
  return result;
}

function resolveRepoRoot(targetPath) {
  const resolvedTarget = path.resolve(targetPath || process.cwd());
  const result = run('git', ['-C', resolvedTarget, 'rev-parse', '--show-toplevel']);
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(
      `Target is not inside a git repository: ${resolvedTarget}${stderr ? `\n${stderr}` : ''}`,
    );
  }
  return result.stdout.trim();
}

function toDestinationPath(relativeTemplatePath) {
  if (relativeTemplatePath.startsWith('scripts/')) {
    return relativeTemplatePath;
  }
  if (relativeTemplatePath.startsWith('githooks/')) {
    return `.${relativeTemplatePath}`;
  }
  throw new Error(`Unsupported template path: ${relativeTemplatePath}`);
}

function ensureParentDir(filePath, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureExecutable(destinationPath, relativePath, dryRun) {
  if (dryRun) return;
  if (EXECUTABLE_RELATIVE_PATHS.has(relativePath)) {
    fs.chmodSync(destinationPath, 0o755);
  }
}

function copyTemplateFile(repoRoot, relativeTemplatePath, force, dryRun) {
  const sourcePath = path.join(TEMPLATE_ROOT, relativeTemplatePath);
  const destinationRelativePath = toDestinationPath(relativeTemplatePath);
  const destinationPath = path.join(repoRoot, destinationRelativePath);

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const destinationExists = fs.existsSync(destinationPath);

  if (destinationExists) {
    const existingContent = fs.readFileSync(destinationPath, 'utf8');
    if (existingContent === sourceContent) {
      ensureExecutable(destinationPath, destinationRelativePath, dryRun);
      return { status: 'unchanged', file: destinationRelativePath };
    }
    if (!force) {
      throw new Error(
        `Refusing to overwrite existing file without --force: ${destinationRelativePath}`,
      );
    }
  }

  ensureParentDir(destinationPath, dryRun);
  if (!dryRun) {
    fs.writeFileSync(destinationPath, sourceContent, 'utf8');
    ensureExecutable(destinationPath, destinationRelativePath, dryRun);
  }

  return { status: destinationExists ? 'overwritten' : 'created', file: destinationRelativePath };
}

function ensureTemplateFilePresent(repoRoot, relativeTemplatePath, dryRun) {
  const sourcePath = path.join(TEMPLATE_ROOT, relativeTemplatePath);
  const destinationRelativePath = toDestinationPath(relativeTemplatePath);
  const destinationPath = path.join(repoRoot, destinationRelativePath);
  const sourceContent = fs.readFileSync(sourcePath, 'utf8');

  if (fs.existsSync(destinationPath)) {
    const existingContent = fs.readFileSync(destinationPath, 'utf8');
    if (existingContent === sourceContent) {
      ensureExecutable(destinationPath, destinationRelativePath, dryRun);
      return { status: 'unchanged', file: destinationRelativePath };
    }

    // In fix mode, avoid silently replacing local customizations.
    return { status: 'skipped-conflict', file: destinationRelativePath };
  }

  ensureParentDir(destinationPath, dryRun);
  if (!dryRun) {
    fs.writeFileSync(destinationPath, sourceContent, 'utf8');
    ensureExecutable(destinationPath, destinationRelativePath, dryRun);
  }

  return { status: 'created', file: destinationRelativePath };
}

function lockFilePath(repoRoot) {
  return path.join(repoRoot, LOCK_FILE_RELATIVE);
}

function ensureLockRegistry(repoRoot, dryRun) {
  const absolutePath = lockFilePath(repoRoot);
  if (fs.existsSync(absolutePath)) {
    return { status: 'unchanged', file: LOCK_FILE_RELATIVE };
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify({ locks: {} }, null, 2) + '\n', 'utf8');
  }

  return { status: 'created', file: LOCK_FILE_RELATIVE };
}

function lockStateOrError(repoRoot) {
  const lockPath = lockFilePath(repoRoot);
  if (!fs.existsSync(lockPath)) {
    return { ok: false, error: `${LOCK_FILE_RELATIVE} is missing` };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.locks !== 'object' || parsed.locks === null) {
      return { ok: false, error: `${LOCK_FILE_RELATIVE} has invalid schema (expected { locks: {} })` };
    }

    // Normalize older schema entries.
    for (const [filePath, entry] of Object.entries(parsed.locks)) {
      if (!entry || typeof entry !== 'object') {
        parsed.locks[filePath] = { branch: '', claimed_at: '', allow_delete: false };
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(entry, 'allow_delete')) {
        entry.allow_delete = false;
      }
    }

    return { ok: true, raw: parsed, locks: parsed.locks };
  } catch (error) {
    return { ok: false, error: `${LOCK_FILE_RELATIVE} is invalid JSON: ${error.message}` };
  }
}

function writeLockState(repoRoot, payload, dryRun) {
  if (dryRun) return;
  const lockPath = lockFilePath(repoRoot);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function ensurePackageScripts(repoRoot, dryRun) {
  const packagePath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return { status: 'skipped', file: 'package.json', note: 'package.json not found' };
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse package.json in target repo: ${error.message}`);
  }

  const wantedScripts = {
    'agent:branch:start': 'bash ./scripts/agent-branch-start.sh',
    'agent:branch:finish': 'bash ./scripts/agent-branch-finish.sh',
    'agent:hooks:install': 'bash ./scripts/install-agent-git-hooks.sh',
    'agent:locks:claim': 'python3 ./scripts/agent-file-locks.py claim',
    'agent:locks:allow-delete': 'python3 ./scripts/agent-file-locks.py allow-delete',
    'agent:locks:release': 'python3 ./scripts/agent-file-locks.py release',
    'agent:locks:status': 'python3 ./scripts/agent-file-locks.py status',
    'agent:safety:setup': `${TOOL_NAME} setup`,
    'agent:safety:scan': `${TOOL_NAME} scan`,
    'agent:safety:fix': `${TOOL_NAME} fix`,
  };

  pkg.scripts = pkg.scripts || {};
  let changed = false;
  for (const [key, value] of Object.entries(wantedScripts)) {
    if (pkg.scripts[key] !== value) {
      pkg.scripts[key] = value;
      changed = true;
    }
  }

  if (!changed) {
    return { status: 'unchanged', file: 'package.json' };
  }

  if (!dryRun) {
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  return { status: 'updated', file: 'package.json' };
}

function ensureAgentsSnippet(repoRoot, dryRun) {
  const agentsPath = path.join(repoRoot, 'AGENTS.md');
  const snippet = fs.readFileSync(path.join(TEMPLATE_ROOT, 'AGENTS.multiagent-safety.md'), 'utf8').trimEnd();

  if (!fs.existsSync(agentsPath)) {
    if (!dryRun) {
      fs.writeFileSync(agentsPath, `# AGENTS\n\n${snippet}\n`, 'utf8');
    }
    return { status: 'created', file: 'AGENTS.md' };
  }

  const existing = fs.readFileSync(agentsPath, 'utf8');
  if (existing.includes(AGENTS_MARKER_START)) {
    return { status: 'unchanged', file: 'AGENTS.md' };
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  if (!dryRun) {
    fs.writeFileSync(agentsPath, `${existing}${separator}${snippet}\n`, 'utf8');
  }

  return { status: 'updated', file: 'AGENTS.md' };
}

function configureHooks(repoRoot, dryRun) {
  if (dryRun) {
    return { status: 'would-set', key: 'core.hooksPath', value: '.githooks' };
  }

  const result = run('git', ['-C', repoRoot, 'config', 'core.hooksPath', '.githooks']);
  if (result.status !== 0) {
    throw new Error(`Failed to set git hooksPath: ${(result.stderr || '').trim()}`);
  }

  return { status: 'set', key: 'core.hooksPath', value: '.githooks' };
}

function parseCommonArgs(rawArgs, defaults) {
  const options = { ...defaults };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target') {
      options.target = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--skip-agents') {
      options.skipAgents = true;
      continue;
    }
    if (arg === '--skip-package-json') {
      options.skipPackageJson = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--keep-stale-locks') {
      options.dropStaleLocks = false;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--yes-global-install') {
      options.yesGlobalInstall = true;
      continue;
    }
    if (arg === '--no-global-install') {
      options.noGlobalInstall = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.target) {
    throw new Error('--target requires a path value');
  }

  return options;
}

function isInteractiveTerminal() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function readSingleLineFromStdin() {
  let input = '';
  const buffer = Buffer.alloc(1);

  while (true) {
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(process.stdin.fd, buffer, 0, 1);
    } catch {
      return input;
    }

    if (bytesRead === 0) {
      return input;
    }

    const char = buffer.toString('utf8', 0, bytesRead);
    if (char === '\n' || char === '\r') {
      return input;
    }
    input += char;
  }
}

function promptYesNo(question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  while (true) {
    process.stdout.write(`${question} ${hint} `);
    const answer = readSingleLineFromStdin().trim().toLowerCase();

    if (!answer) {
      return defaultYes;
    }
    if (answer === 'y' || answer === 'yes') {
      return true;
    }
    if (answer === 'n' || answer === 'no') {
      return false;
    }
    process.stdout.write('Please answer with y or n.\n');
  }
}

function promptYesNoStrict(question) {
  while (true) {
    process.stdout.write(`${question} [y/n] `);
    const answer = readSingleLineFromStdin().trim().toLowerCase();

    if (answer === 'y' || answer === 'yes') {
      process.stdout.write('\n');
      return true;
    }
    if (answer === 'n' || answer === 'no') {
      process.stdout.write('\n');
      return false;
    }

    process.stdout.write('Please answer with y or n.\n');
  }
}

function resolveGlobalInstallApproval(options) {
  if (options.yesGlobalInstall && options.noGlobalInstall) {
    throw new Error('Cannot use both --yes-global-install and --no-global-install');
  }

  if (options.yesGlobalInstall) {
    return { approved: true, source: 'flag' };
  }

  if (options.noGlobalInstall) {
    return { approved: false, source: 'flag' };
  }

  if (!isInteractiveTerminal()) {
    return { approved: false, source: 'non-interactive-default' };
  }
  return { approved: true, source: 'prompt' };
}

function detectGlobalToolchainPackages() {
  const result = run(NPM_BIN, ['list', '-g', '--depth=0', '--json']);
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    return {
      ok: false,
      error: stderr || 'Unable to detect globally installed npm packages',
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse npm list output: ${error.message}`,
    };
  }

  const dependencyMap = parsed && parsed.dependencies && typeof parsed.dependencies === 'object'
    ? parsed.dependencies
    : {};
  const installedSet = new Set(Object.keys(dependencyMap));

  const installed = [];
  const missing = [];
  for (const pkg of GLOBAL_TOOLCHAIN_PACKAGES) {
    if (installedSet.has(pkg)) {
      installed.push(pkg);
    } else {
      missing.push(pkg);
    }
  }

  return { ok: true, installed, missing };
}

function askGlobalInstallForMissing(options, missingPackages) {
  const approval = resolveGlobalInstallApproval(options);
  if (!approval.approved) {
    return approval;
  }

  if (approval.source === 'prompt') {
    const approved = promptYesNoStrict(
      `Install missing global tools now? (npm i -g ${missingPackages.join(' ')})`,
    );
    return { approved, source: 'prompt' };
  }

  return approval;
}

function installGlobalToolchain(options) {
  if (options.dryRun) {
    return { status: 'dry-run-skip' };
  }

  const detection = detectGlobalToolchainPackages();
  if (!detection.ok) {
    console.log(`[${TOOL_NAME}] ⚠️ Could not detect global packages: ${detection.error}`);
  } else {
    if (detection.installed.length > 0) {
      console.log(`[${TOOL_NAME}] Already installed globally: ${detection.installed.join(', ')}`);
    }
    if (detection.missing.length === 0) {
      return { status: 'already-installed' };
    }
  }

  const missingPackages = detection.ok ? detection.missing : [...GLOBAL_TOOLCHAIN_PACKAGES];
  const approval = askGlobalInstallForMissing(options, missingPackages);
  if (!approval.approved) {
    return { status: 'skipped', reason: approval.source };
  }

  console.log(
    `[${TOOL_NAME}] Installing global toolchain: npm i -g ${missingPackages.join(' ')}`,
  );
  const result = run(NPM_BIN, ['i', '-g', ...missingPackages], { stdio: 'inherit' });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    return {
      status: 'failed',
      reason: stderr || 'npm global install failed',
    };
  }

  return { status: 'installed', packages: missingPackages };
}

function gitRefExists(repoRoot, refName) {
  return gitRun(repoRoot, ['show-ref', '--verify', '--quiet', refName], { allowFailure: true }).status === 0;
}

function findStaleLockPaths(repoRoot, locks) {
  const stale = [];

  for (const [filePath, rawEntry] of Object.entries(locks)) {
    const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
    const ownerBranch = String(entry.branch || '');

    const hasOwner = ownerBranch.length > 0;
    const localRef = hasOwner ? `refs/heads/${ownerBranch}` : null;
    const remoteRef = hasOwner ? `refs/remotes/origin/${ownerBranch}` : null;
    const branchExists = hasOwner
      ? gitRefExists(repoRoot, localRef) || gitRefExists(repoRoot, remoteRef)
      : false;

    const pathExists = fs.existsSync(path.join(repoRoot, filePath));

    if (!hasOwner || !branchExists || !pathExists) {
      stale.push(filePath);
    }
  }

  return stale;
}

function runInstallInternal(options) {
  const repoRoot = resolveRepoRoot(options.target);
  const operations = [];

  for (const templateFile of TEMPLATE_FILES) {
    operations.push(copyTemplateFile(repoRoot, templateFile, Boolean(options.force), Boolean(options.dryRun)));
  }

  operations.push(ensureLockRegistry(repoRoot, Boolean(options.dryRun)));

  if (!options.skipPackageJson) {
    operations.push(ensurePackageScripts(repoRoot, Boolean(options.dryRun)));
  }

  if (!options.skipAgents) {
    operations.push(ensureAgentsSnippet(repoRoot, Boolean(options.dryRun)));
  }

  const hookResult = configureHooks(repoRoot, Boolean(options.dryRun));

  return { repoRoot, operations, hookResult };
}

function runFixInternal(options) {
  const repoRoot = resolveRepoRoot(options.target);
  const operations = [];

  for (const templateFile of TEMPLATE_FILES) {
    operations.push(ensureTemplateFilePresent(repoRoot, templateFile, Boolean(options.dryRun)));
  }

  operations.push(ensureLockRegistry(repoRoot, Boolean(options.dryRun)));

  const lockState = lockStateOrError(repoRoot);
  if (!lockState.ok) {
    if (!options.dryRun) {
      writeLockState(repoRoot, { locks: {} }, false);
    }
    operations.push({
      status: options.dryRun ? 'would-reset' : 'reset',
      file: LOCK_FILE_RELATIVE,
      note: 'invalid lock state reset to empty',
    });
  } else {
    const staleLockPaths = options.dropStaleLocks ? findStaleLockPaths(repoRoot, lockState.locks) : [];
    if (staleLockPaths.length > 0) {
      const updated = { ...lockState.raw, locks: { ...lockState.locks } };
      for (const filePath of staleLockPaths) {
        delete updated.locks[filePath];
      }
      writeLockState(repoRoot, updated, Boolean(options.dryRun));
      operations.push({
        status: options.dryRun ? 'would-prune' : 'pruned',
        file: LOCK_FILE_RELATIVE,
        note: `removed ${staleLockPaths.length} stale lock(s)`,
      });
    }
  }

  if (!options.skipPackageJson) {
    operations.push(ensurePackageScripts(repoRoot, Boolean(options.dryRun)));
  }

  if (!options.skipAgents) {
    operations.push(ensureAgentsSnippet(repoRoot, Boolean(options.dryRun)));
  }

  const hookResult = configureHooks(repoRoot, Boolean(options.dryRun));

  return { repoRoot, operations, hookResult };
}

function runScanInternal(options) {
  const repoRoot = resolveRepoRoot(options.target);
  const findings = [];

  const requiredPaths = [
    ...TEMPLATE_FILES.map((entry) => toDestinationPath(entry)),
    LOCK_FILE_RELATIVE,
  ];

  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      findings.push({
        level: 'error',
        code: 'missing-managed-file',
        path: relativePath,
        message: `Missing managed workflow file: ${relativePath}`,
      });
    }
  }

  const hooksPathResult = gitRun(repoRoot, ['config', '--get', 'core.hooksPath'], { allowFailure: true });
  const hooksPath = hooksPathResult.status === 0 ? hooksPathResult.stdout.trim() : '';
  if (hooksPath !== '.githooks') {
    findings.push({
      level: 'warn',
      code: 'hooks-path-mismatch',
      message: `git core.hooksPath is '${hooksPath || '(unset)'}' (expected '.githooks')`,
    });
  }

  const lockState = lockStateOrError(repoRoot);
  if (!lockState.ok) {
    findings.push({
      level: 'error',
      code: 'lock-state-invalid',
      message: lockState.error,
    });
  } else {
    for (const [filePath, rawEntry] of Object.entries(lockState.locks)) {
      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
      const ownerBranch = String(entry.branch || '');
      const allowDelete = Boolean(entry.allow_delete);

      if (!ownerBranch) {
        findings.push({
          level: 'warn',
          code: 'lock-missing-owner',
          path: filePath,
          message: `Lock entry has no owner branch: ${filePath}`,
        });
      }

      const absolutePath = path.join(repoRoot, filePath);
      if (!fs.existsSync(absolutePath)) {
        findings.push({
          level: 'warn',
          code: 'lock-target-missing',
          path: filePath,
          message: `Locked path is missing from disk: ${filePath}`,
        });
      }

      if (ownerBranch) {
        const localRef = `refs/heads/${ownerBranch}`;
        const remoteRef = `refs/remotes/origin/${ownerBranch}`;
        if (!gitRefExists(repoRoot, localRef) && !gitRefExists(repoRoot, remoteRef)) {
          findings.push({
            level: 'warn',
            code: 'stale-branch-lock',
            path: filePath,
            message: `Lock owner branch not found locally/remotely: ${ownerBranch} (${filePath})`,
          });
        }
      }

      if (allowDelete && CRITICAL_GUARDRAIL_PATHS.has(filePath)) {
        findings.push({
          level: 'error',
          code: 'guardrail-delete-approved',
          path: filePath,
          message: `Critical guardrail file is delete-approved: ${filePath}`,
        });
      }
    }
  }

  const errors = findings.filter((item) => item.level === 'error');
  const warnings = findings.filter((item) => item.level === 'warn');

  const currentBranchResult = gitRun(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true });
  const branch = currentBranchResult.status === 0 ? currentBranchResult.stdout.trim() : '(unknown)';

  return {
    repoRoot,
    branch,
    findings,
    errors: errors.length,
    warnings: warnings.length,
  };
}

function printOperations(title, payload, dryRun = false) {
  console.log(`[${TOOL_NAME}] ${title}: ${payload.repoRoot}`);
  for (const operation of payload.operations) {
    const note = operation.note ? ` (${operation.note})` : '';
    console.log(`  - ${operation.status.padEnd(12)} ${operation.file}${note}`);
  }
  console.log(
    `  - hooksPath    ${payload.hookResult.status} ${payload.hookResult.key}=${payload.hookResult.value}`,
  );

  if (dryRun) {
    console.log(`[${TOOL_NAME}] Dry run complete. No files were modified.`);
  }
}

function printScanResult(scan, json = false) {
  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          repoRoot: scan.repoRoot,
          branch: scan.branch,
          errors: scan.errors,
          warnings: scan.warnings,
          findings: scan.findings,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  console.log(`[${TOOL_NAME}] Scan target: ${scan.repoRoot}`);
  console.log(`[${TOOL_NAME}] Branch: ${scan.branch}`);

  if (scan.findings.length === 0) {
    console.log(`[${TOOL_NAME}] ✅ No safety issues detected.`);
    return;
  }

  for (const item of scan.findings) {
    const target = item.path ? ` (${item.path})` : '';
    console.log(`[${item.level.toUpperCase()}] ${item.code}${target}: ${item.message}`);
  }
  console.log(`[${TOOL_NAME}] Summary: ${scan.errors} error(s), ${scan.warnings} warning(s).`);
}

function setExitCodeFromScan(scan) {
  if (scan.errors > 0) {
    process.exitCode = 2;
    return;
  }
  if (scan.warnings > 0) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

function install(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    force: false,
    skipAgents: false,
    skipPackageJson: false,
    dryRun: false,
  });

  const payload = runInstallInternal(options);
  printOperations('Install target', payload, options.dryRun);

  if (!options.dryRun) {
    console.log(`[${TOOL_NAME}] Installed. Next step: ${TOOL_NAME} setup`);
  }

  process.exitCode = 0;
}

function fix(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    dropStaleLocks: true,
    skipAgents: false,
    skipPackageJson: false,
    dryRun: false,
  });

  const payload = runFixInternal(options);
  printOperations('Fix target', payload, options.dryRun);

  if (!options.dryRun) {
    console.log(`[${TOOL_NAME}] Repair complete. Next step: ${TOOL_NAME} scan`);
  }

  process.exitCode = 0;
}

function scan(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    json: false,
  });

  const result = runScanInternal(options);
  printScanResult(result, options.json);
  setExitCodeFromScan(result);
}

function setup(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    force: false,
    skipAgents: false,
    skipPackageJson: false,
    dryRun: false,
    yesGlobalInstall: false,
    noGlobalInstall: false,
  });

  const globalInstallStatus = installGlobalToolchain(options);
  if (globalInstallStatus.status === 'installed') {
    console.log(
      `[${TOOL_NAME}] ✅ Global tools installed (${(globalInstallStatus.packages || []).join(', ')}).`,
    );
  } else if (globalInstallStatus.status === 'already-installed') {
    console.log(`[${TOOL_NAME}] ✅ OMX/OpenSpec global tools already installed. Skipping.`);
  } else if (globalInstallStatus.status === 'failed') {
    console.log(
      `[${TOOL_NAME}] ⚠️ Global install failed: ${globalInstallStatus.reason}\n` +
      `[${TOOL_NAME}] Continue with local safety setup. You can retry later with:\n` +
      `  ${NPM_BIN} i -g ${GLOBAL_TOOLCHAIN_PACKAGES.join(' ')}`,
    );
  } else if (globalInstallStatus.status === 'skipped' && globalInstallStatus.reason === 'non-interactive-default') {
    console.log(
      `[${TOOL_NAME}] Skipping global installs (non-interactive mode). ` +
      `Use --yes-global-install to force or run interactively for Y/N prompt.`,
    );
  }

  const installPayload = runInstallInternal(options);
  printOperations('Setup/install', installPayload, options.dryRun);

  const fixPayload = runFixInternal({
    target: options.target,
    dryRun: options.dryRun,
    dropStaleLocks: true,
    skipAgents: options.skipAgents,
    skipPackageJson: options.skipPackageJson,
  });
  printOperations('Setup/fix', fixPayload, options.dryRun);

  if (options.dryRun) {
    console.log(`[${TOOL_NAME}] Dry run setup done.`);
    process.exitCode = 0;
    return;
  }

  const scanResult = runScanInternal({ target: options.target, json: false });
  printScanResult(scanResult, false);

  if (scanResult.errors === 0 && scanResult.warnings === 0) {
    console.log(`[${TOOL_NAME}] ✅ Setup complete.`);
    console.log(`[${TOOL_NAME}] Copy AI setup prompt with: ${TOOL_NAME} copy-prompt`);
  }

  setExitCodeFromScan(scanResult);
}

function ensureMainBranch(repoRoot) {
  const branchResult = gitRun(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true });
  if (branchResult.status !== 0) {
    throw new Error(`Unable to detect current branch in ${repoRoot}`);
  }

  const branch = branchResult.stdout.trim();
  if (branch !== 'main') {
    throw new Error(`Release blocked: current branch is '${branch}' (required: 'main')`);
  }
}

function ensureCleanWorkingTree(repoRoot) {
  const statusResult = gitRun(repoRoot, ['status', '--porcelain'], { allowFailure: true });
  if (statusResult.status !== 0) {
    throw new Error(`Unable to read git status in ${repoRoot}`);
  }

  const dirty = statusResult.stdout.trim();
  if (dirty.length > 0) {
    throw new Error('Release blocked: working tree is not clean');
  }
}

function release(rawArgs) {
  if (rawArgs.length > 0) {
    throw new Error(`Unknown option: ${rawArgs[0]}`);
  }

  const repoRoot = resolveRepoRoot(process.cwd());
  if (path.resolve(repoRoot) !== MAINTAINER_RELEASE_REPO) {
    throw new Error(
      `Release blocked: command only allowed in ${MAINTAINER_RELEASE_REPO} (current: ${repoRoot})`,
    );
  }

  ensureMainBranch(repoRoot);
  ensureCleanWorkingTree(repoRoot);

  console.log(`[${TOOL_NAME}] Releasing ${packageJson.name}@${packageJson.version} from ${repoRoot}`);
  const publishResult = run(NPM_BIN, ['publish'], { cwd: repoRoot, stdio: 'inherit' });
  if (publishResult.status !== 0) {
    throw new Error('npm publish failed');
  }

  console.log(`[${TOOL_NAME}] ✅ Publish complete.`);
  process.exitCode = 0;
}

function printAgentsSnippet() {
  const snippetPath = path.join(TEMPLATE_ROOT, 'AGENTS.multiagent-safety.md');
  process.stdout.write(fs.readFileSync(snippetPath, 'utf8'));
}

function copyPrompt() {
  process.stdout.write(AI_SETUP_PROMPT);
  process.exitCode = 0;
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

function maybeSuggestCommand(command) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of SUGGESTIBLE_COMMANDS) {
    const dist = levenshteinDistance(command, candidate);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = candidate;
    }
  }

  if (best && bestDistance <= 2) {
    return best;
  }

  return null;
}

function normalizeCommandOrThrow(command) {
  if (COMMAND_TYPO_ALIASES.has(command)) {
    const mapped = COMMAND_TYPO_ALIASES.get(command);
    console.log(`[${TOOL_NAME}] Interpreting '${command}' as '${mapped}'.`);
    return mapped;
  }
  return command;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    setup([]);
    return;
  }

  const [rawCommand, ...rest] = args;
  const command = normalizeCommandOrThrow(rawCommand);

  if (command === '--help' || command === '-h' || command === 'help') {
    usage();
    return;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(packageJson.version);
    return;
  }

  if (command === 'setup') {
    setup(rest);
    return;
  }

  if (command === 'copy-prompt') {
    copyPrompt();
    return;
  }

  if (command === 'release') {
    release(rest);
    return;
  }

  if (command === 'install') {
    install(rest);
    return;
  }

  if (command === 'fix') {
    fix(rest);
    return;
  }

  if (command === 'scan') {
    scan(rest);
    return;
  }

  if (command === 'print-agents-snippet') {
    printAgentsSnippet();
    return;
  }

  const suggestion = maybeSuggestCommand(command);
  if (suggestion) {
    throw new Error(`Unknown command: ${command}. Did you mean '${suggestion}'?`);
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`[${TOOL_NAME}] ${error.message}`);
  process.exitCode = 1;
}
