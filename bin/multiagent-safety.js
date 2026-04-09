#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

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

function usage() {
  console.log(`multiagent-safety v${packageJson.version}

Usage:
  multiagent-safety install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--dry-run]
  multiagent-safety scan [--target <path>] [--json]
  multiagent-safety print-agents-snippet
  multiagent-safety --help

Examples:
  multiagent-safety install
  multiagent-safety scan
  multiagent-safety install --target ~/projects/my-repo
  npm i -g multiagent-safety && multiagent-safety install`);
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

function copyTemplateFile(repoRoot, relativeTemplatePath, force, dryRun) {
  const sourcePath = path.join(TEMPLATE_ROOT, relativeTemplatePath);
  const destinationRelativePath = toDestinationPath(relativeTemplatePath);
  const destinationPath = path.join(repoRoot, destinationRelativePath);

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const destinationExists = fs.existsSync(destinationPath);

  if (destinationExists) {
    const existingContent = fs.readFileSync(destinationPath, 'utf8');
    if (existingContent === sourceContent) {
      if (!dryRun && EXECUTABLE_RELATIVE_PATHS.has(destinationRelativePath)) {
        fs.chmodSync(destinationPath, 0o755);
      }
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
    if (EXECUTABLE_RELATIVE_PATHS.has(destinationRelativePath)) {
      fs.chmodSync(destinationPath, 0o755);
    }
  }

  return { status: destinationExists ? 'overwritten' : 'created', file: destinationRelativePath };
}

function ensureLockRegistry(repoRoot, dryRun) {
  const relativePath = LOCK_FILE_RELATIVE;
  const absolutePath = path.join(repoRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    return { status: 'unchanged', file: relativePath };
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify({ locks: {} }, null, 2) + '\n', 'utf8');
  }
  return { status: 'created', file: relativePath };
}

function ensurePackageScripts(repoRoot, dryRun) {
  const relativePath = 'package.json';
  const packagePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(packagePath)) {
    return { status: 'skipped', file: relativePath, note: 'package.json not found' };
  }

  const content = fs.readFileSync(packagePath, 'utf8');
  let pkg;
  try {
    pkg = JSON.parse(content);
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
    return { status: 'unchanged', file: relativePath };
  }

  if (!dryRun) {
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  return { status: 'updated', file: relativePath };
}

function ensureAgentsSnippet(repoRoot, dryRun) {
  const relativePath = 'AGENTS.md';
  const agentsPath = path.join(repoRoot, relativePath);
  const snippet = fs.readFileSync(path.join(TEMPLATE_ROOT, 'AGENTS.multiagent-safety.md'), 'utf8').trimEnd();

  if (!fs.existsSync(agentsPath)) {
    if (!dryRun) {
      fs.writeFileSync(agentsPath, `# AGENTS\n\n${snippet}\n`, 'utf8');
    }
    return { status: 'created', file: relativePath };
  }

  const existing = fs.readFileSync(agentsPath, 'utf8');
  if (existing.includes(AGENTS_MARKER_START)) {
    return { status: 'unchanged', file: relativePath };
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  if (!dryRun) {
    fs.writeFileSync(agentsPath, `${existing}${separator}${snippet}\n`, 'utf8');
  }

  return { status: 'updated', file: relativePath };
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

function parseInstallArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    force: false,
    skipAgents: false,
    skipPackageJson: false,
    dryRun: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target') {
      options.target = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
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
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.target) {
    throw new Error('--target requires a path value');
  }

  return options;
}

function parseScanArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    json: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target') {
      options.target = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.target) {
    throw new Error('--target requires a path value');
  }

  return options;
}

function lockStateOrError(repoRoot) {
  const lockPath = path.join(repoRoot, LOCK_FILE_RELATIVE);
  if (!fs.existsSync(lockPath)) {
    return { ok: false, error: `${LOCK_FILE_RELATIVE} is missing` };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.locks !== 'object' || parsed.locks === null) {
      return { ok: false, error: `${LOCK_FILE_RELATIVE} has invalid schema (expected { locks: {} })` };
    }
    return { ok: true, locks: parsed.locks };
  } catch (error) {
    return { ok: false, error: `${LOCK_FILE_RELATIVE} is invalid JSON: ${error.message}` };
  }
}

function gitRefExists(repoRoot, refName) {
  return gitRun(repoRoot, ['show-ref', '--verify', '--quiet', refName], { allowFailure: true }).status === 0;
}

function runScan(rawArgs) {
  const options = parseScanArgs(rawArgs);
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
  const currentBranch = currentBranchResult.status === 0 ? currentBranchResult.stdout.trim() : '(unknown)';

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          repoRoot,
          branch: currentBranch,
          errors: errors.length,
          warnings: warnings.length,
          findings,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    console.log(`[multiagent-safety] Scan target: ${repoRoot}`);
    console.log(`[multiagent-safety] Branch: ${currentBranch}`);
    if (findings.length === 0) {
      console.log('[multiagent-safety] ✅ No safety issues detected.');
    } else {
      for (const item of findings) {
        const target = item.path ? ` (${item.path})` : '';
        console.log(`[${item.level.toUpperCase()}] ${item.code}${target}: ${item.message}`);
      }
      console.log(`[multiagent-safety] Summary: ${errors.length} error(s), ${warnings.length} warning(s).`);
    }
  }

  if (errors.length > 0) {
    process.exitCode = 2;
    return;
  }
  if (warnings.length > 0) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

function install(rawArgs) {
  const options = parseInstallArgs(rawArgs);
  const repoRoot = resolveRepoRoot(options.target);

  const operations = [];

  for (const templateFile of TEMPLATE_FILES) {
    operations.push(copyTemplateFile(repoRoot, templateFile, options.force, options.dryRun));
  }

  operations.push(ensureLockRegistry(repoRoot, options.dryRun));

  if (!options.skipPackageJson) {
    operations.push(ensurePackageScripts(repoRoot, options.dryRun));
  }

  if (!options.skipAgents) {
    operations.push(ensureAgentsSnippet(repoRoot, options.dryRun));
  }

  const hookResult = configureHooks(repoRoot, options.dryRun);

  console.log(`[multiagent-safety] Target repo: ${repoRoot}`);
  for (const operation of operations) {
    const note = operation.note ? ` (${operation.note})` : '';
    console.log(`  - ${operation.status.padEnd(10)} ${operation.file}${note}`);
  }
  console.log(`  - hooksPath  ${hookResult.status} ${hookResult.key}=${hookResult.value}`);

  if (options.dryRun) {
    console.log('[multiagent-safety] Dry run complete. No files were modified.');
  } else {
    console.log('[multiagent-safety] Installed multi-agent safety workflow.');
    console.log('[multiagent-safety] Next step: run `multiagent-safety scan` in the repo.');
  }
}

function printAgentsSnippet() {
  const snippetPath = path.join(TEMPLATE_ROOT, 'AGENTS.multiagent-safety.md');
  process.stdout.write(fs.readFileSync(snippetPath, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    install([]);
    return;
  }

  const [command, ...rest] = args;
  if (command === '--help' || command === '-h' || command === 'help') {
    usage();
    return;
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(packageJson.version);
    return;
  }
  if (command === 'install') {
    install(rest);
    return;
  }
  if (command === 'scan') {
    runScan(rest);
    return;
  }
  if (command === 'print-agents-snippet') {
    printAgentsSnippet();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`[multiagent-safety] ${error.message}`);
  process.exitCode = 1;
}
