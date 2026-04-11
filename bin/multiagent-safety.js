#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const TOOL_NAME = 'guardex';
const SHORT_TOOL_NAME = 'gx';
const LEGACY_NAMES = ['musafety', 'multiagent-safety'];
const GLOBAL_TOOLCHAIN_PACKAGES = ['oh-my-codex', '@fission-ai/openspec'];
const MAINTAINER_RELEASE_REPO = path.resolve(
  process.env.MUSAFETY_RELEASE_REPO || '/tmp/multiagent-safety',
);
const NPM_BIN = process.env.MUSAFETY_NPM_BIN || 'npm';
const SCORECARD_BIN = process.env.MUSAFETY_SCORECARD_BIN || 'scorecard';
const GIT_PROTECTED_BRANCHES_KEY = 'multiagent.protectedBranches';
const GIT_BASE_BRANCH_KEY = 'multiagent.baseBranch';
const GIT_SYNC_STRATEGY_KEY = 'multiagent.sync.strategy';
const DEFAULT_PROTECTED_BRANCHES = ['dev', 'main', 'master'];
const DEFAULT_BASE_BRANCH = 'dev';
const DEFAULT_SYNC_STRATEGY = 'rebase';

const TEMPLATE_ROOT = path.resolve(__dirname, '..', 'templates');

const TEMPLATE_FILES = [
  'scripts/agent-branch-start.sh',
  'scripts/agent-branch-finish.sh',
  'scripts/codex-agent.sh',
  'scripts/agent-worktree-prune.sh',
  'scripts/agent-file-locks.py',
  'scripts/install-agent-git-hooks.sh',
  'scripts/openspec/init-plan-workspace.sh',
  'githooks/pre-commit',
  'codex/skills/guardex/SKILL.md',
  'claude/commands/guardex.md',
];

const EXECUTABLE_RELATIVE_PATHS = new Set([
  'scripts/agent-branch-start.sh',
  'scripts/agent-branch-finish.sh',
  'scripts/codex-agent.sh',
  'scripts/agent-worktree-prune.sh',
  'scripts/agent-file-locks.py',
  'scripts/install-agent-git-hooks.sh',
  'scripts/openspec/init-plan-workspace.sh',
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
const GITIGNORE_MARKER_START = '# multiagent-safety:START';
const GITIGNORE_MARKER_END = '# multiagent-safety:END';
const MANAGED_GITIGNORE_PATHS = [
  'scripts/agent-branch-start.sh',
  'scripts/agent-branch-finish.sh',
  'scripts/codex-agent.sh',
  'scripts/agent-worktree-prune.sh',
  'scripts/agent-file-locks.py',
  'scripts/install-agent-git-hooks.sh',
  'scripts/openspec/init-plan-workspace.sh',
  '.githooks/pre-commit',
  'oh-my-codex/',
  '.codex/skills/guardex/SKILL.md',
  '.claude/commands/guardex.md',
  LOCK_FILE_RELATIVE,
];
const COMMAND_TYPO_ALIASES = new Map([
  ['relaese', 'release'],
  ['realaese', 'release'],
  ['relase', 'release'],
  ['setpu', 'setup'],
  ['inti', 'init'],
  ['intsall', 'install'],
  ['docter', 'doctor'],
  ['doctro', 'doctor'],
  ['scna', 'scan'],
]);
const SUGGESTIBLE_COMMANDS = [
  'status',
  'setup',
  'init',
  'doctor',
  'report',
  'copy-prompt',
  'copy-commands',
  'protect',
  'sync',
  'release',
  'install',
  'fix',
  'scan',
  'print-agents-snippet',
  'help',
  'version',
];
const CLI_COMMAND_DESCRIPTIONS = [
  ['status', 'Show GuardeX CLI + service health without modifying files'],
  ['setup', 'Install + repair guardrails in a git repo (supports --no-gitignore)'],
  ['init', 'Alias of setup (bootstrap + repair guardrails in a git repo)'],
  ['doctor', 'Repair safety setup drift, then verify repo safety'],
  ['report', 'Generate security/safety reports (for example: OpenSSF scorecard)'],
  ['copy-prompt', 'Print the AI-ready setup checklist'],
  ['copy-commands', 'Print setup checklist as executable commands only'],
  ['protect', 'Manage protected branches (list/add/remove/set/reset)'],
  ['sync', 'Check or sync agent branches with origin/<base>'],
  ['install', 'Install templates/locks/hooks without running full setup (supports --no-gitignore)'],
  ['fix', 'Repair broken or missing guardrail files/config (supports --no-gitignore)'],
  ['scan', 'Report safety issues and exit non-zero on findings'],
  ['print-agents-snippet', 'Print the AGENTS.md snippet template'],
  ['release', 'Publish GuardeX from maintainer release repo'],
  ['help', 'Show this help output'],
  ['version', 'Print GuardeX version'],
];

const AI_SETUP_PROMPT = `Use this exact checklist to setup GuardeX (Guardian T-Rex for your repo) in this repository for Codex or Claude.

1) Install (if missing):
   npm i -g @imdeadpool/guardex

2) Bootstrap safety in this repo:
   gx setup
   # alias: gx init

   - Setup detects global OMX/OpenSpec first.
   - If one is missing and setup asks for approval, reply explicitly:
     - y = run: npm i -g oh-my-codex @fission-ai/openspec (missing ones only)
     - n = skip global installs

3) If setup reports warnings/errors, repair + re-check:
   gx doctor

4) Confirm next safe agent workflow commands:
   bash scripts/codex-agent.sh "task" "agent-name"
   bash scripts/agent-branch-start.sh "task" "agent-name"
   python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
   bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
   - For every new user message/task, repeat the same cycle:
     start isolated agent branch/worktree -> claim file locks -> implement/verify ->
     finish via PR/merge cleanup with scripts/agent-branch-finish.sh.

5) Optional: create OpenSpec planning workspace:
   bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"

6) Optional: protect extra branches:
   gx protect add release staging

7) Optional: sync your current agent branch with latest base branch:
   gx sync --check
   gx sync

8) Optional (GitHub remote cleanup): enable:
   Settings -> General -> Pull Requests -> Automatically delete head branches
`;

const AI_SETUP_COMMANDS = `npm i -g @imdeadpool/guardex
gx setup
gx doctor
bash scripts/codex-agent.sh "task" "agent-name"
bash scripts/agent-branch-start.sh "task" "agent-name"
python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"
gx protect add release staging
gx sync --check
gx sync
`;

const SCORECARD_RISK_BY_CHECK = {
  'Dangerous-Workflow': 'Critical',
  'Code-Review': 'High',
  Maintained: 'High',
  'Binary-Artifacts': 'High',
  'Dependency-Update-Tool': 'High',
  'Token-Permissions': 'High',
  Vulnerabilities: 'High',
  'Branch-Protection': 'High',
  Fuzzing: 'Medium',
  'Pinned-Dependencies': 'Medium',
  SAST: 'Medium',
  'Security-Policy': 'Medium',
  'CII-Best-Practices': 'Low',
  Contributors: 'Low',
  License: 'Low',
};

function runtimeVersion() {
  return `${packageJson.name}/${packageJson.version} ${process.platform}-${process.arch} node-${process.version}`;
}

function supportsAnsiColors() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
}

function colorize(text, colorCode) {
  if (!supportsAnsiColors()) {
    return text;
  }
  return `\u001B[${colorCode}m${text}\u001B[0m`;
}

function statusDot(status) {
  if (status === 'active') {
    return colorize('●', '32'); // green
  }
  if (status === 'inactive') {
    return colorize('●', '31'); // red
  }
  return colorize('●', '33'); // yellow for degraded/unknown
}

function commandCatalogLines(indent = '  ') {
  const maxCommandLength = CLI_COMMAND_DESCRIPTIONS.reduce(
    (max, [command]) => Math.max(max, command.length),
    0,
  );
  return CLI_COMMAND_DESCRIPTIONS.map(
    ([command, description]) => `${indent}${command.padEnd(maxCommandLength + 2)}${description}`,
  );
}

function printToolLogsSummary() {
  const usageLine = `    $ ${SHORT_TOOL_NAME} <command> [options]`;
  const commandDetails = commandCatalogLines('    ');

  if (!supportsAnsiColors()) {
    console.log(`${TOOL_NAME}-tools logs:`);
    console.log('  USAGE');
    console.log(usageLine);
    console.log('  COMMANDS');
    for (const line of commandDetails) {
      console.log(line);
    }
    return;
  }

  const title = colorize(`${TOOL_NAME}-tools logs`, '1;36');
  const usageHeader = colorize('USAGE', '1');
  const commandsHeader = colorize('COMMANDS', '1');
  const pipe = colorize('│', '90');
  const tee = colorize('├', '90');
  const corner = colorize('└', '90');

  console.log(`${title}:`);
  console.log(`  ${tee}─ ${usageHeader}`);
  console.log(`  ${pipe}${usageLine}`);
  console.log(`  ${tee}─ ${commandsHeader}`);
  for (const line of commandDetails) {
    if (!line) {
      console.log(`  ${pipe}`);
      continue;
    }
    console.log(`  ${pipe}${line.slice(2)}`);
  }
  console.log(`  ${corner}─ ${colorize(`Try '${TOOL_NAME} doctor' for one-step repair + verification.`, '2')}`);
}

function usage(options = {}) {
  const { outsideGitRepo = false } = options;

  console.log(`A command-line tool that sets up hardened multi-agent safety for git repositories.

VERSION
  ${runtimeVersion()}

USAGE
  $ ${SHORT_TOOL_NAME} <command> [options]

COMMANDS
${commandCatalogLines().join('\n')}

NOTES
  - Running ${TOOL_NAME} with no command defaults to: ${SHORT_TOOL_NAME} status
  - Short alias: ${SHORT_TOOL_NAME}
  - ${SHORT_TOOL_NAME} init is an alias of ${SHORT_TOOL_NAME} setup
  - ${TOOL_NAME} setup asks for Y/N approval before global installs
  - Legacy command aliases are still supported: ${LEGACY_NAMES.join(', ')}`);

  if (outsideGitRepo) {
    console.log(`
[${TOOL_NAME}] No git repository detected in current directory.
[${TOOL_NAME}] Start from a repo root, or pass an explicit target:
  ${TOOL_NAME} setup --target <path-to-git-repo>`);
  }
}

function run(cmd, args, options = {}) {
  return cp.spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    cwd: options.cwd,
    timeout: options.timeout,
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

function isGitRepo(targetPath) {
  const resolvedTarget = path.resolve(targetPath || process.cwd());
  const result = run('git', ['-C', resolvedTarget, 'rev-parse', '--show-toplevel']);
  return result.status === 0;
}

function toDestinationPath(relativeTemplatePath) {
  if (relativeTemplatePath.startsWith('scripts/')) {
    return relativeTemplatePath;
  }
  if (relativeTemplatePath.startsWith('githooks/')) {
    return `.${relativeTemplatePath}`;
  }
  if (relativeTemplatePath.startsWith('codex/')) {
    return `.${relativeTemplatePath}`;
  }
  if (relativeTemplatePath.startsWith('claude/')) {
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
    'agent:codex': 'bash ./scripts/codex-agent.sh',
    'agent:branch:start': 'bash ./scripts/agent-branch-start.sh',
    'agent:branch:finish': 'bash ./scripts/agent-branch-finish.sh',
    'agent:cleanup': 'bash ./scripts/agent-worktree-prune.sh --base dev',
    'agent:hooks:install': 'bash ./scripts/install-agent-git-hooks.sh',
    'agent:locks:claim': 'python3 ./scripts/agent-file-locks.py claim',
    'agent:locks:allow-delete': 'python3 ./scripts/agent-file-locks.py allow-delete',
    'agent:locks:release': 'python3 ./scripts/agent-file-locks.py release',
    'agent:locks:status': 'python3 ./scripts/agent-file-locks.py status',
    'agent:plan:init': 'bash ./scripts/openspec/init-plan-workspace.sh',
    'agent:protect:list': `${SHORT_TOOL_NAME} protect list`,
    'agent:branch:sync': `${SHORT_TOOL_NAME} sync`,
    'agent:branch:sync:check': `${SHORT_TOOL_NAME} sync --check`,
    'agent:safety:setup': `${SHORT_TOOL_NAME} setup`,
    'agent:safety:scan': `${SHORT_TOOL_NAME} scan`,
    'agent:safety:fix': `${SHORT_TOOL_NAME} fix`,
    'agent:safety:doctor': `${SHORT_TOOL_NAME} doctor`,
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

function ensureManagedGitignore(repoRoot, dryRun) {
  const gitignorePath = path.join(repoRoot, '.gitignore');
  const managedBlock = [
    GITIGNORE_MARKER_START,
    ...MANAGED_GITIGNORE_PATHS,
    GITIGNORE_MARKER_END,
  ].join('\n');
  const managedRegex = new RegExp(
    `${GITIGNORE_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${GITIGNORE_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'm',
  );

  if (!fs.existsSync(gitignorePath)) {
    if (!dryRun) {
      fs.writeFileSync(gitignorePath, `${managedBlock}\n`, 'utf8');
    }
    return { status: 'created', file: '.gitignore', note: 'added guardex-managed entries' };
  }

  const existing = fs.readFileSync(gitignorePath, 'utf8');
  if (managedRegex.test(existing)) {
    const next = existing.replace(managedRegex, managedBlock);
    if (next === existing) {
      return { status: 'unchanged', file: '.gitignore' };
    }
    if (!dryRun) {
      fs.writeFileSync(gitignorePath, next, 'utf8');
    }
    return { status: 'updated', file: '.gitignore', note: 'refreshed guardex-managed entries' };
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  if (!dryRun) {
    fs.writeFileSync(gitignorePath, `${existing}${separator}${managedBlock}\n`, 'utf8');
  }
  return { status: 'updated', file: '.gitignore', note: 'appended guardex-managed entries' };
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
    if (arg === '--no-gitignore') {
      options.skipGitignore = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.target) {
    throw new Error('--target requires a path value');
  }

  return options;
}

function parseTargetFlag(rawArgs, defaultTarget = process.cwd()) {
  const remaining = [];
  let target = defaultTarget;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--target requires a path value');
      }
      target = next;
      index += 1;
      continue;
    }
    remaining.push(arg);
  }

  return { target, args: remaining };
}

function parseReportArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    subcommand: '',
    repo: '',
    scorecardJson: '',
    outputDir: '',
    date: '',
    dryRun: false,
    json: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--target requires a path value');
      options.target = next;
      index += 1;
      continue;
    }
    if (arg === '--repo') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--repo requires a value like github.com/owner/repo');
      options.repo = next;
      index += 1;
      continue;
    }
    if (arg === '--scorecard-json') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--scorecard-json requires a path value');
      options.scorecardJson = next;
      index += 1;
      continue;
    }
    if (arg === '--output-dir') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--output-dir requires a path value');
      options.outputDir = next;
      index += 1;
      continue;
    }
    if (arg === '--date') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--date requires a YYYY-MM-DD value');
      options.date = next;
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!options.subcommand) {
      options.subcommand = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return options;
}

function todayDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function inferGithubRepoFromOrigin(repoRoot) {
  const rawOrigin = readGitConfig(repoRoot, 'remote.origin.url');
  if (!rawOrigin) return '';

  const httpsMatch = rawOrigin.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  if (!httpsMatch) return '';
  const slug = (httpsMatch[1] || '').replace(/^\/+/, '').trim();
  if (!slug || !slug.includes('/')) return '';
  return `github.com/${slug}`;
}

function resolveScorecardRepo(repoRoot, explicitRepo) {
  if (explicitRepo) {
    return explicitRepo.trim();
  }
  const inferred = inferGithubRepoFromOrigin(repoRoot);
  if (inferred) return inferred;
  throw new Error(
    'Unable to infer GitHub repo from origin remote. Pass --repo github.com/<owner>/<repo>.',
  );
}

function runScorecardJson(repo) {
  const result = run(SCORECARD_BIN, ['--repo', repo, '--format', 'json'], { allowFailure: true });
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `Failed to run scorecard CLI ('${SCORECARD_BIN} --repo ${repo} --format json').${details ? `\n${details}` : ''}`,
    );
  }

  try {
    return JSON.parse(result.stdout || '{}');
  } catch (error) {
    throw new Error(`Unable to parse scorecard JSON output: ${error.message}`);
  }
}

function readScorecardJsonFile(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`scorecard JSON file not found: ${absolute}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse scorecard JSON file: ${error.message}`);
  }
}

function normalizeScorecardChecks(payload) {
  const rawChecks = Array.isArray(payload?.checks) ? payload.checks : [];
  return rawChecks.map((check) => {
    const name = String(check?.name || 'Unknown');
    const rawScore = Number(check?.score);
    const score = Number.isFinite(rawScore) ? rawScore : 0;
    return {
      name,
      score,
      risk: SCORECARD_RISK_BY_CHECK[name] || 'Unknown',
    };
  });
}

function renderScorecardBaselineMarkdown({ repo, score, checks, capturedAt, scorecardVersion, reportDate }) {
  const rows = checks
    .map((item) => `| ${item.name} | ${item.score} | ${item.risk} |`)
    .join('\n');

  return [
    '# OpenSSF Scorecard Baseline Report',
    '',
    `- **Repository:** \`${repo}\``,
    '- **Source:** generated by `gx report scorecard`',
    `- **Captured at:** ${capturedAt}`,
    `- **Scorecard version:** \`${scorecardVersion}\``,
    `- **Overall score:** **${score} / 10**`,
    '',
    '## Check breakdown',
    '',
    '| Check | Score | Risk |',
    '|---|---:|---|',
    rows || '| (none) | 0 | Unknown |',
    '',
    `## Report date`,
    '',
    `- ${reportDate}`,
    '',
  ].join('\n');
}

function renderScorecardRemediationPlanMarkdown({ baselineRelativePath, checks }) {
  const failing = checks.filter((item) => item.score < 10);
  const failingRows = failing
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .map((item) => `| ${item.name} | ${item.score} | ${item.risk} |`)
    .join('\n');

  return [
    '# OpenSSF Scorecard Remediation Plan',
    '',
    `Based on baseline report: \`${baselineRelativePath}\`.`,
    '',
    '## Failing checks',
    '',
    '| Check | Score | Risk |',
    '|---|---:|---|',
    (failingRows || '| None | 10 | N/A |'),
    '',
    '## Priority order',
    '',
    '1. Fix **High** risk checks first (especially score 0 items).',
    '2. Then close **Medium** risk checks with score < 10.',
    '3. Finally address **Low** risk ecosystem/process checks.',
    '',
    '## Verification loop',
    '',
    '1. Run scorecard again.',
    '2. Re-generate baseline + remediation files.',
    '3. Compare score deltas and track improved checks.',
    '',
  ].join('\n');
}

function parseBranchList(rawValue) {
  return String(rawValue || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniquePreserveOrder(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function readProtectedBranches(repoRoot) {
  const result = gitRun(repoRoot, ['config', '--get', GIT_PROTECTED_BRANCHES_KEY], { allowFailure: true });
  if (result.status !== 0) {
    return [...DEFAULT_PROTECTED_BRANCHES];
  }

  const parsed = uniquePreserveOrder(parseBranchList(result.stdout.trim()));
  if (parsed.length === 0) {
    return [...DEFAULT_PROTECTED_BRANCHES];
  }
  return parsed;
}

function writeProtectedBranches(repoRoot, branches) {
  if (branches.length === 0) {
    gitRun(repoRoot, ['config', '--unset-all', GIT_PROTECTED_BRANCHES_KEY], { allowFailure: true });
    return;
  }
  gitRun(repoRoot, ['config', GIT_PROTECTED_BRANCHES_KEY, branches.join(' ')]);
}

function readGitConfig(repoRoot, key) {
  const result = gitRun(repoRoot, ['config', '--get', key], { allowFailure: true });
  if (result.status !== 0) {
    return '';
  }
  return (result.stdout || '').trim();
}

function resolveBaseBranch(repoRoot, explicitBase) {
  if (explicitBase) {
    return explicitBase;
  }
  const configured = readGitConfig(repoRoot, GIT_BASE_BRANCH_KEY);
  return configured || DEFAULT_BASE_BRANCH;
}

function resolveSyncStrategy(repoRoot, explicitStrategy) {
  const strategy = (explicitStrategy || readGitConfig(repoRoot, GIT_SYNC_STRATEGY_KEY) || DEFAULT_SYNC_STRATEGY)
    .trim()
    .toLowerCase();
  if (strategy !== 'rebase' && strategy !== 'merge') {
    throw new Error(`Invalid sync strategy '${strategy}' (expected: rebase or merge)`);
  }
  return strategy;
}

function currentBranchName(repoRoot) {
  const result = gitRun(repoRoot, ['branch', '--show-current'], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error('Unable to detect current branch');
  }
  const branch = (result.stdout || '').trim();
  if (!branch) {
    throw new Error('Detached HEAD is not supported for sync operations');
  }
  return branch;
}

function workingTreeIsDirty(repoRoot) {
  const result = gitRun(repoRoot, ['status', '--porcelain'], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error('Unable to inspect git working tree status');
  }
  const lines = (result.stdout || '').split('\n').filter((line) => line.length > 0);
  const significant = lines.filter((line) => {
    const pathPart = (line.length > 3 ? line.slice(3) : '').trim();
    if (!pathPart) return false;
    if (pathPart === LOCK_FILE_RELATIVE) return false;
    if (pathPart.startsWith(`${LOCK_FILE_RELATIVE} -> `)) return false;
    if (pathPart.endsWith(` -> ${LOCK_FILE_RELATIVE}`)) return false;
    return true;
  });
  return significant.length > 0;
}

function ensureOriginBaseRef(repoRoot, baseBranch) {
  const fetch = gitRun(repoRoot, ['fetch', 'origin', baseBranch, '--quiet'], { allowFailure: true });
  if (fetch.status !== 0) {
    throw new Error(
      `Unable to fetch origin/${baseBranch}. Ensure remote 'origin' exists and branch '${baseBranch}' is available.`,
    );
  }
  const hasRemoteBase = gitRun(repoRoot, ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${baseBranch}`], {
    allowFailure: true,
  });
  if (hasRemoteBase.status !== 0) {
    throw new Error(`Remote base branch not found: origin/${baseBranch}`);
  }
}

function aheadBehind(repoRoot, branchRef, baseRef) {
  const result = gitRun(repoRoot, ['rev-list', '--left-right', '--count', `${branchRef}...${baseRef}`], {
    allowFailure: true,
  });
  if (result.status !== 0) {
    throw new Error(`Unable to compute ahead/behind for ${branchRef} vs ${baseRef}`);
  }
  const parts = (result.stdout || '').trim().split(/\s+/).filter(Boolean);
  const ahead = Number.parseInt(parts[0] || '0', 10);
  const behind = Number.parseInt(parts[1] || '0', 10);
  return { ahead: Number.isFinite(ahead) ? ahead : 0, behind: Number.isFinite(behind) ? behind : 0 };
}

function lockRegistryStatus(repoRoot) {
  const result = gitRun(repoRoot, ['status', '--porcelain', '--', LOCK_FILE_RELATIVE], { allowFailure: true });
  if (result.status !== 0) {
    return { dirty: false, untracked: false };
  }
  const lines = (result.stdout || '').split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { dirty: false, untracked: false };
  }
  const untracked = lines.some((line) => line.startsWith('??'));
  return { dirty: true, untracked };
}

function parseSyncArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    check: false,
    base: '',
    strategy: '',
    ffOnly: false,
    dryRun: false,
    json: false,
    allAgentBranches: false,
    allowNonAgent: false,
    allowDirty: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--target requires a path value');
      }
      options.target = next;
      index += 1;
      continue;
    }
    if (arg === '--base') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--base requires a branch value');
      }
      options.base = next;
      index += 1;
      continue;
    }
    if (arg === '--strategy') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--strategy requires a value (rebase|merge)');
      }
      options.strategy = next;
      index += 1;
      continue;
    }
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    if (arg === '--ff-only') {
      options.ffOnly = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--all-agent-branches') {
      options.allAgentBranches = true;
      continue;
    }
    if (arg === '--allow-non-agent') {
      options.allowNonAgent = true;
      continue;
    }
    if (arg === '--allow-dirty') {
      options.allowDirty = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.target) {
    throw new Error('--target requires a path value');
  }

  return options;
}

function syncOperation(repoRoot, strategy, baseRef, ffOnly) {
  if (strategy === 'rebase') {
    if (ffOnly) {
      throw new Error('--ff-only is only supported with --strategy merge');
    }
    const rebased = run('git', ['-C', repoRoot, 'rebase', baseRef], { stdio: 'pipe' });
    if (rebased.status !== 0) {
      const details = (rebased.stderr || rebased.stdout || '').trim();
      const gitDir = path.join(repoRoot, '.git');
      const rebaseActive = fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'));
      const help = rebaseActive
        ? '\nResolve conflicts, then run: git rebase --continue\nOr abort: git rebase --abort'
        : '';
      throw new Error(`Sync failed during rebase onto ${baseRef}.${details ? `\n${details}` : ''}${help}`);
    }
    return;
  }

  const mergeArgs = ['-C', repoRoot, 'merge', '--no-edit'];
  if (ffOnly) {
    mergeArgs.push('--ff-only');
  }
  mergeArgs.push(baseRef);
  const merged = run('git', mergeArgs, { stdio: 'pipe' });
  if (merged.status !== 0) {
    const details = (merged.stderr || merged.stdout || '').trim();
    const gitDir = path.join(repoRoot, '.git');
    const mergeActive = fs.existsSync(path.join(gitDir, 'MERGE_HEAD'));
    const help = mergeActive ? '\nResolve conflicts, then run: git commit\nOr abort: git merge --abort' : '';
    throw new Error(`Sync failed during merge from ${baseRef}.${details ? `\n${details}` : ''}${help}`);
  }
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

function envFlagEnabled(name) {
  const raw = process.env[name];
  if (raw == null) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function parseAutoApproval(name) {
  const raw = process.env[name];
  if (raw == null) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
}

function parseVersionString(version) {
  const match = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ];
}

function isNewerVersion(latest, current) {
  const latestParts = parseVersionString(latest);
  const currentParts = parseVersionString(current);

  if (!latestParts || !currentParts) {
    return String(latest || '').trim() !== String(current || '').trim();
  }

  for (let index = 0; index < latestParts.length; index += 1) {
    if (latestParts[index] > currentParts[index]) return true;
    if (latestParts[index] < currentParts[index]) return false;
  }
  return false;
}

function parseNpmVersionOutput(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return String(parsed[parsed.length - 1] || '').trim();
    }
    return String(parsed || '').trim();
  } catch {
    const firstLine = trimmed.split('\n').map((line) => line.trim()).find(Boolean);
    return firstLine || '';
  }
}

function checkForMusafetyUpdate() {
  if (envFlagEnabled('MUSAFETY_SKIP_UPDATE_CHECK')) {
    return { checked: false, reason: 'disabled' };
  }

  const forceCheck = envFlagEnabled('MUSAFETY_FORCE_UPDATE_CHECK');
  if (!forceCheck && !isInteractiveTerminal()) {
    return { checked: false, reason: 'non-interactive' };
  }

  const result = run(NPM_BIN, ['view', packageJson.name, 'version', '--json'], { timeout: 5000 });
  if (result.status !== 0) {
    return { checked: false, reason: 'lookup-failed' };
  }

  const latest = parseNpmVersionOutput(result.stdout);
  if (!latest) {
    return { checked: false, reason: 'invalid-latest-version' };
  }

  return {
    checked: true,
    current: packageJson.version,
    latest,
    updateAvailable: isNewerVersion(latest, packageJson.version),
  };
}

function printUpdateAvailableBanner(current, latest) {
  const title = colorize('UPDATE AVAILABLE', '1;33');
  console.log(`[${TOOL_NAME}] ${title}`);
  console.log(`[${TOOL_NAME}]   Current: ${current}`);
  console.log(`[${TOOL_NAME}]   Latest : ${latest}`);
  console.log(`[${TOOL_NAME}]   Command: ${NPM_BIN} i -g ${packageJson.name}@latest`);
}

function maybeSelfUpdateBeforeStatus() {
  const check = checkForMusafetyUpdate();
  if (!check.checked || !check.updateAvailable) {
    return;
  }

  printUpdateAvailableBanner(check.current, check.latest);

  const autoApproval = parseAutoApproval('MUSAFETY_AUTO_UPDATE_APPROVAL');
  const interactive = isInteractiveTerminal();

  if (!interactive && autoApproval == null) {
    console.log(`[${TOOL_NAME}] Non-interactive shell; skipping auto-update prompt.`);
    return;
  }

  const shouldUpdate = interactive
    ? promptYesNo(
      `Update now? (${NPM_BIN} i -g ${packageJson.name}@latest)`,
      false,
    )
    : autoApproval;

  if (!shouldUpdate) {
    console.log(`[${TOOL_NAME}] Skipped update.`);
    return;
  }

  const installResult = run(NPM_BIN, ['i', '-g', `${packageJson.name}@latest`], { stdio: 'inherit' });
  if (installResult.status !== 0) {
    console.log(`[${TOOL_NAME}] ⚠️ Update failed. You can retry manually.`);
    return;
  }

  console.log(`[${TOOL_NAME}] ✅ Updated to latest published version.`);
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
  if (!options.skipGitignore) {
    operations.push(ensureManagedGitignore(repoRoot, Boolean(options.dryRun)));
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

function runFixInternal(options) {
  const repoRoot = resolveRepoRoot(options.target);
  const operations = [];

  for (const templateFile of TEMPLATE_FILES) {
    operations.push(ensureTemplateFilePresent(repoRoot, templateFile, Boolean(options.dryRun)));
  }

  operations.push(ensureLockRegistry(repoRoot, Boolean(options.dryRun)));
  if (!options.skipGitignore) {
    operations.push(ensureManagedGitignore(repoRoot, Boolean(options.dryRun)));
  }

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

function status(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    json: false,
  });

  const toolchain = detectGlobalToolchainPackages();
  const services = GLOBAL_TOOLCHAIN_PACKAGES.map((pkg) => {
    if (!toolchain.ok) {
      return { name: pkg, status: 'unknown' };
    }
    return {
      name: pkg,
      status: toolchain.installed.includes(pkg) ? 'active' : 'inactive',
    };
  });

  const targetPath = path.resolve(options.target);
  const inGitRepo = isGitRepo(targetPath);
  const scanResult = inGitRepo ? runScanInternal({ target: targetPath, json: false }) : null;
  const repoServiceStatus = scanResult
    ? (scanResult.errors === 0 && scanResult.warnings === 0 ? 'active' : 'degraded')
    : 'inactive';

  const payload = {
    cli: {
      name: packageJson.name,
      version: packageJson.version,
      runtime: runtimeVersion(),
    },
    services,
    repo: {
      target: targetPath,
      inGitRepo,
      serviceStatus: repoServiceStatus,
      scan: scanResult
        ? {
          repoRoot: scanResult.repoRoot,
          branch: scanResult.branch,
          errors: scanResult.errors,
          warnings: scanResult.warnings,
          findings: scanResult.findings.length,
        }
        : null,
    },
    detectionError: toolchain.ok ? null : toolchain.error,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 0;
    return;
  }

  console.log(`[${TOOL_NAME}] CLI: ${payload.cli.runtime}`);
  if (!toolchain.ok) {
    console.log(`[${TOOL_NAME}] ⚠️ Could not detect global services: ${toolchain.error}`);
  }

  console.log(`[${TOOL_NAME}] Global services:`);
  for (const service of services) {
    console.log(`  - ${statusDot(service.status)} ${service.name}: ${service.status}`);
  }

  if (!scanResult) {
    console.log(
      `[${TOOL_NAME}] Repo safety service: ${statusDot('inactive')} inactive (no git repository at target).`,
    );
    process.exitCode = 0;
    return;
  }

  if (scanResult.errors === 0 && scanResult.warnings === 0) {
    console.log(`[${TOOL_NAME}] Repo safety service: ${statusDot('active')} active.`);
  } else {
    console.log(
      `[${TOOL_NAME}] Repo safety service: ${statusDot('degraded')} degraded (${scanResult.errors} error(s), ${scanResult.warnings} warning(s)).`,
    );
    console.log(`[${TOOL_NAME}] Run '${TOOL_NAME} scan' for detailed findings.`);
  }
  console.log(`[${TOOL_NAME}] Repo: ${scanResult.repoRoot}`);
  console.log(`[${TOOL_NAME}] Branch: ${scanResult.branch}`);
  printToolLogsSummary();

  process.exitCode = 0;
}

function install(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    force: false,
    skipAgents: false,
    skipPackageJson: false,
    skipGitignore: false,
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
    skipGitignore: false,
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

function doctor(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    dropStaleLocks: true,
    skipAgents: false,
    skipPackageJson: false,
    skipGitignore: false,
    dryRun: false,
    json: false,
  });

  const fixPayload = runFixInternal(options);
  const scanResult = runScanInternal({ target: options.target, json: false });
  const musafe = scanResult.errors === 0 && scanResult.warnings === 0;

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          repoRoot: scanResult.repoRoot,
          branch: scanResult.branch,
          musafe,
          fix: {
            operations: fixPayload.operations,
            hookResult: fixPayload.hookResult,
            dryRun: Boolean(options.dryRun),
          },
          scan: {
            errors: scanResult.errors,
            warnings: scanResult.warnings,
            findings: scanResult.findings,
          },
        },
        null,
        2,
      ) + '\n',
    );
    setExitCodeFromScan(scanResult);
    return;
  }

  printOperations('Doctor/fix', fixPayload, options.dryRun);
  printScanResult(scanResult, false);
  if (musafe) {
    console.log(`[${TOOL_NAME}] ✅ Repo is correctly musafe.`);
  } else {
    console.log(
      `[${TOOL_NAME}] ⚠️ Repo is not fully musafe yet (${scanResult.errors} error(s), ${scanResult.warnings} warning(s)).`,
    );
  }
  setExitCodeFromScan(scanResult);
}

function report(rawArgs) {
  const options = parseReportArgs(rawArgs);
  const subcommand = options.subcommand || 'help';
  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    console.log(
      `${TOOL_NAME} report commands:\n` +
      `  ${TOOL_NAME} report scorecard [--target <path>] [--repo github.com/<owner>/<repo>] [--scorecard-json <file>] [--output-dir <path>] [--date YYYY-MM-DD] [--dry-run] [--json]\n` +
      `\n` +
      `Examples:\n` +
      `  ${TOOL_NAME} report scorecard --repo github.com/recodeecom/multiagent-safety\n` +
      `  ${TOOL_NAME} report scorecard --scorecard-json ./scorecard.json --date 2026-04-10`,
    );
    process.exitCode = 0;
    return;
  }

  if (subcommand !== 'scorecard') {
    throw new Error(`Unknown report subcommand: ${subcommand}`);
  }

  const repoRoot = resolveRepoRoot(options.target);
  const repo = resolveScorecardRepo(repoRoot, options.repo);
  const payload = options.scorecardJson
    ? readScorecardJsonFile(options.scorecardJson)
    : runScorecardJson(repo);

  const reportDate = options.date || todayDateStamp();
  const outputDir = path.resolve(options.outputDir || path.join(repoRoot, 'docs', 'reports'));
  const baselinePath = path.join(outputDir, `openssf-scorecard-baseline-${reportDate}.md`);
  const remediationPath = path.join(outputDir, `openssf-scorecard-remediation-plan-${reportDate}.md`);

  const checks = normalizeScorecardChecks(payload);
  const rawScore = Number(payload?.score);
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const capturedAt = String(payload?.date || new Date().toISOString());
  const scorecardVersion = String(payload?.scorecard?.version || payload?.version || 'unknown');

  const baselineMarkdown = renderScorecardBaselineMarkdown({
    repo,
    score,
    checks,
    capturedAt,
    scorecardVersion,
    reportDate,
  });

  const remediationMarkdown = renderScorecardRemediationPlanMarkdown({
    baselineRelativePath: path.relative(repoRoot, baselinePath) || path.basename(baselinePath),
    checks,
  });

  if (!options.dryRun) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(baselinePath, baselineMarkdown, 'utf8');
    fs.writeFileSync(remediationPath, remediationMarkdown, 'utf8');
  }

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          repoRoot,
          repo,
          score,
          checks: checks.length,
          outputDir,
          baselinePath,
          remediationPath,
          dryRun: Boolean(options.dryRun),
        },
        null,
        2,
      ) + '\n',
    );
    process.exitCode = 0;
    return;
  }

  console.log(`[${TOOL_NAME}] Report target: ${repoRoot}`);
  console.log(`[${TOOL_NAME}] Scorecard repo: ${repo}`);
  console.log(`[${TOOL_NAME}] Score: ${score}/10`);
  if (options.dryRun) {
    console.log(`[${TOOL_NAME}] Dry run report paths:`);
  } else {
    console.log(`[${TOOL_NAME}] Generated reports:`);
  }
  console.log(`  - ${baselinePath}`);
  console.log(`  - ${remediationPath}`);
  process.exitCode = 0;
}

function setup(rawArgs) {
  const options = parseCommonArgs(rawArgs, {
    target: process.cwd(),
    force: false,
    skipAgents: false,
    skipPackageJson: false,
    skipGitignore: false,
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
    skipGitignore: options.skipGitignore,
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
    console.log(`[${TOOL_NAME}] Copy AI setup prompt with: ${SHORT_TOOL_NAME} copy-prompt`);
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

function copyCommands() {
  process.stdout.write(AI_SETUP_COMMANDS);
  process.exitCode = 0;
}

function sync(rawArgs) {
  const options = parseSyncArgs(rawArgs);
  const repoRoot = resolveRepoRoot(options.target);
  const baseBranch = resolveBaseBranch(repoRoot, options.base);
  const strategy = resolveSyncStrategy(repoRoot, options.strategy);
  const baseRef = `origin/${baseBranch}`;

  ensureOriginBaseRef(repoRoot, baseBranch);

  if (options.allAgentBranches) {
    const refs = gitRun(repoRoot, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/agent/*'], { allowFailure: true });
    if (refs.status !== 0) {
      throw new Error('Unable to list local agent branches');
    }
    const branches = (refs.stdout || '').split('\n').map((item) => item.trim()).filter(Boolean);
    const rows = branches.map((branch) => {
      const counts = aheadBehind(repoRoot, branch, baseRef);
      return {
        branch,
        base: baseRef,
        ahead: counts.ahead,
        behind: counts.behind,
        syncRequired: counts.behind > 0,
      };
    });

    if (options.json) {
      process.stdout.write(`${JSON.stringify({
        repoRoot,
        base: baseRef,
        branchCount: rows.length,
        rows,
      }, null, 2)}\n`);
    } else {
      console.log(`[${TOOL_NAME}] Sync report target: ${repoRoot}`);
      console.log(`[${TOOL_NAME}] Base: ${baseRef}`);
      if (rows.length === 0) {
        console.log(`[${TOOL_NAME}] No local agent branches found.`);
      } else {
        for (const row of rows) {
          console.log(`  - ${row.branch} | ahead ${row.ahead} | behind ${row.behind} | syncRequired=${row.syncRequired}`);
        }
      }
    }

    const hasBehind = rows.some((row) => row.behind > 0);
    process.exitCode = options.check && hasBehind ? 1 : 0;
    return;
  }

  const branch = currentBranchName(repoRoot);
  if (!options.allowNonAgent && !branch.startsWith('agent/')) {
    throw new Error(`sync is limited to agent/* branches by default (current: ${branch}). Use --allow-non-agent to override.`);
  }

  const dirty = workingTreeIsDirty(repoRoot);
  if (!options.check && !options.allowDirty && dirty) {
    throw new Error('Sync blocked: working tree is not clean. Commit or stash changes first, or pass --allow-dirty.');
  }

  const before = aheadBehind(repoRoot, branch, baseRef);

  const payload = {
    repoRoot,
    branch,
    base: baseRef,
    strategy,
    dirty,
    aheadBefore: before.ahead,
    behindBefore: before.behind,
    syncRequired: before.behind > 0,
    status: 'checked',
  };

  if (options.check) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      console.log(`[${TOOL_NAME}] Sync check target: ${repoRoot}`);
      console.log(`[${TOOL_NAME}] Branch: ${branch}`);
      console.log(`[${TOOL_NAME}] Base: ${baseRef}`);
      console.log(`[${TOOL_NAME}] Ahead: ${before.ahead}`);
      console.log(`[${TOOL_NAME}] Behind: ${before.behind}`);
      console.log(`[${TOOL_NAME}] Sync required: ${before.behind > 0 ? 'yes' : 'no'}`);
    }
    process.exitCode = before.behind > 0 ? 1 : 0;
    return;
  }

  if (before.behind === 0) {
    const result = { ...payload, status: 'no-op', aheadAfter: before.ahead, behindAfter: before.behind };
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log(`[${TOOL_NAME}] Branch '${branch}' is already up to date with ${baseRef}.`);
    }
    process.exitCode = 0;
    return;
  }

  if (options.dryRun) {
    const result = { ...payload, status: 'dry-run' };
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      console.log(`[${TOOL_NAME}] Dry run: would sync '${branch}' onto ${baseRef} via ${strategy}.`);
    }
    process.exitCode = 0;
    return;
  }

  const lockPath = path.join(repoRoot, LOCK_FILE_RELATIVE);
  const lockState = lockRegistryStatus(repoRoot);
  let lockBackup = null;
  if (lockState.dirty && fs.existsSync(lockPath)) {
    lockBackup = fs.readFileSync(lockPath, 'utf8');
  }

  if (lockState.dirty) {
    if (lockState.untracked) {
      fs.rmSync(lockPath, { force: true });
    } else {
      const resetLock = gitRun(repoRoot, ['checkout', '--', LOCK_FILE_RELATIVE], { allowFailure: true });
      if (resetLock.status !== 0) {
        throw new Error(`Unable to temporarily reset ${LOCK_FILE_RELATIVE} before sync`);
      }
    }
  }

  try {
    syncOperation(repoRoot, strategy, baseRef, options.ffOnly);
  } finally {
    if (lockBackup !== null) {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      fs.writeFileSync(lockPath, lockBackup, 'utf8');
    }
  }
  const after = aheadBehind(repoRoot, branch, baseRef);
  const result = {
    ...payload,
    status: 'success',
    aheadAfter: after.ahead,
    behindAfter: after.behind,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`[${TOOL_NAME}] Sync target: ${repoRoot}`);
    console.log(`[${TOOL_NAME}] Branch: ${branch}`);
    console.log(`[${TOOL_NAME}] Base: ${baseRef}`);
    console.log(`[${TOOL_NAME}] Strategy: ${strategy}`);
    console.log(`[${TOOL_NAME}] Behind before sync: ${before.behind}`);
    console.log(`[${TOOL_NAME}] Result: success (behind now: ${after.behind})`);
  }

  process.exitCode = 0;
}

function protect(rawArgs) {
  const parsed = parseTargetFlag(rawArgs, process.cwd());
  const [subcommand, ...rest] = parsed.args;
  const repoRoot = resolveRepoRoot(parsed.target);

  if (!subcommand || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    console.log(
      `${TOOL_NAME} protect commands:\n` +
      `  ${TOOL_NAME} protect list [--target <path>]\n` +
      `  ${TOOL_NAME} protect add <branch...> [--target <path>]\n` +
      `  ${TOOL_NAME} protect remove <branch...> [--target <path>]\n` +
      `  ${TOOL_NAME} protect set <branch...> [--target <path>]\n` +
      `  ${TOOL_NAME} protect reset [--target <path>]`,
    );
    process.exitCode = 0;
    return;
  }

  const requestedBranches = uniquePreserveOrder(parseBranchList(rest.join(' ')));

  if (subcommand === 'list') {
    const branches = readProtectedBranches(repoRoot);
    console.log(`[${TOOL_NAME}] Protected branches (${branches.length}): ${branches.join(', ')}`);
    process.exitCode = 0;
    return;
  }

  if (subcommand === 'add') {
    if (requestedBranches.length === 0) {
      throw new Error('protect add requires one or more branch names');
    }
    const current = readProtectedBranches(repoRoot);
    const next = uniquePreserveOrder([...current, ...requestedBranches]);
    writeProtectedBranches(repoRoot, next);
    console.log(`[${TOOL_NAME}] Protected branches updated: ${next.join(', ')}`);
    process.exitCode = 0;
    return;
  }

  if (subcommand === 'remove') {
    if (requestedBranches.length === 0) {
      throw new Error('protect remove requires one or more branch names');
    }
    const current = readProtectedBranches(repoRoot);
    const removals = new Set(requestedBranches);
    const next = current.filter((branch) => !removals.has(branch));
    writeProtectedBranches(repoRoot, next);
    console.log(
      `[${TOOL_NAME}] Protected branches updated: ` +
      `${(next.length > 0 ? next : DEFAULT_PROTECTED_BRANCHES).join(', ')}`,
    );
    if (next.length === 0) {
      console.log(`[${TOOL_NAME}] Reset to defaults (${DEFAULT_PROTECTED_BRANCHES.join(', ')}) because list was empty.`);
    }
    process.exitCode = 0;
    return;
  }

  if (subcommand === 'set') {
    if (requestedBranches.length === 0) {
      throw new Error('protect set requires one or more branch names');
    }
    writeProtectedBranches(repoRoot, requestedBranches);
    console.log(`[${TOOL_NAME}] Protected branches set: ${requestedBranches.join(', ')}`);
    process.exitCode = 0;
    return;
  }

  if (subcommand === 'reset') {
    writeProtectedBranches(repoRoot, []);
    console.log(`[${TOOL_NAME}] Protected branches reset to defaults: ${DEFAULT_PROTECTED_BRANCHES.join(', ')}`);
    process.exitCode = 0;
    return;
  }

  throw new Error(`Unknown protect subcommand: ${subcommand}`);
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
    maybeSelfUpdateBeforeStatus();
    status([]);
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

  if (command === 'status') {
    status(rest);
    return;
  }

  if (command === 'setup' || command === 'init') {
    setup(rest);
    return;
  }

  if (command === 'doctor') {
    doctor(rest);
    return;
  }

  if (command === 'report') {
    report(rest);
    return;
  }

  if (command === 'copy-prompt') {
    copyPrompt();
    return;
  }

  if (command === 'copy-commands') {
    copyCommands();
    return;
  }

  if (command === 'protect') {
    protect(rest);
    return;
  }

  if (command === 'sync') {
    sync(rest);
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
