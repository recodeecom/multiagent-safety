const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY_PATH = path.join(PACKAGE_ROOT, 'bin', 'multiagent-safety.js');
const packageJsonPath = path.join(PACKAGE_ROOT, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const TOOL_NAME = 'gitguardex';
const SHORT_TOOL_NAME = 'gx';
if (!process.env.GUARDEX_CLI_ENTRY) {
  process.env.GUARDEX_CLI_ENTRY = CLI_ENTRY_PATH;
}
if (!process.env.GUARDEX_NODE_BIN) {
  process.env.GUARDEX_NODE_BIN = process.execPath;
}
const LEGACY_NAMES = ['guardex', 'multiagent-safety'];
const GLOBAL_INSTALL_COMMAND = `npm i -g ${packageJson.name}`;
const OPENSPEC_PACKAGE = '@fission-ai/openspec';
const OMC_PACKAGE = 'oh-my-claude-sisyphus';
const OMC_REPO_URL = 'https://github.com/Yeachan-Heo/oh-my-claudecode';
const CAVEMEM_PACKAGE = 'cavemem';
const NPX_BIN = process.env.GUARDEX_NPX_BIN || 'npx';
const GUARDEX_HOME_DIR = path.resolve(process.env.GUARDEX_HOME_DIR || os.homedir());
const GLOBAL_TOOLCHAIN_SERVICES = [
  { name: 'oh-my-codex', packageName: 'oh-my-codex' },
  {
    name: 'oh-my-claudecode',
    packageName: OMC_PACKAGE,
    dependencyUrl: OMC_REPO_URL,
  },
  { name: OPENSPEC_PACKAGE, packageName: OPENSPEC_PACKAGE },
  { name: CAVEMEM_PACKAGE, packageName: CAVEMEM_PACKAGE },
  {
    name: '@imdeadpool/codex-account-switcher',
    packageName: '@imdeadpool/codex-account-switcher',
  },
];
const GLOBAL_TOOLCHAIN_PACKAGES = [
  ...GLOBAL_TOOLCHAIN_SERVICES.map((service) => service.packageName),
];
const OPTIONAL_LOCAL_COMPANION_TOOLS = [
  {
    name: 'cavekit',
    candidatePaths: [
      '.cavekit/plugin.json',
      '.codex/local-marketplaces/cavekit/.agents/plugins/marketplace.json',
    ],
    installCommand: `${NPX_BIN} skills add JuliusBrussee/cavekit`,
    installArgs: ['skills', 'add', 'JuliusBrussee/cavekit'],
  },
  {
    name: 'caveman',
    candidatePaths: [
      '.config/caveman/config.json',
      '.cavekit/skills/caveman/SKILL.md',
    ],
    installCommand: `${NPX_BIN} skills add JuliusBrussee/caveman`,
    installArgs: ['skills', 'add', 'JuliusBrussee/caveman'],
  },
];
const GH_BIN = process.env.GUARDEX_GH_BIN || 'gh';
const REQUIRED_SYSTEM_TOOLS = [
  {
    name: 'gh',
    displayName: 'GitHub (gh)',
    command: GH_BIN,
    installHint: 'https://cli.github.com/',
  },
];
const MAINTAINER_RELEASE_REPO = path.resolve(
  process.env.GUARDEX_RELEASE_REPO || path.resolve(PACKAGE_ROOT),
);
const NPM_BIN = process.env.GUARDEX_NPM_BIN || 'npm';
const OPENSPEC_BIN = process.env.GUARDEX_OPENSPEC_BIN || 'openspec';
const SCORECARD_BIN = process.env.GUARDEX_SCORECARD_BIN || 'scorecard';
const GIT_PROTECTED_BRANCHES_KEY = 'multiagent.protectedBranches';
const GIT_BASE_BRANCH_KEY = 'multiagent.baseBranch';
const GIT_SYNC_STRATEGY_KEY = 'multiagent.sync.strategy';
const GUARDEX_REPO_TOGGLE_ENV = 'GUARDEX_ON';
const DEFAULT_PROTECTED_BRANCHES = ['dev', 'main', 'master'];
const DEFAULT_BASE_BRANCH = 'dev';
const DEFAULT_SYNC_STRATEGY = 'rebase';
const DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES = 60;
const COMPOSE_HINT_FILES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
];

const TEMPLATE_ROOT = path.join(PACKAGE_ROOT, 'templates');

const HOOK_NAMES = ['pre-commit', 'pre-push', 'post-merge', 'post-checkout'];

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
  if (relativeTemplatePath.startsWith('github/')) {
    return `.${relativeTemplatePath}`;
  }
  if (relativeTemplatePath.startsWith('vscode/')) {
    return relativeTemplatePath;
  }
  throw new Error(`Unsupported template path: ${relativeTemplatePath}`);
}

const TEMPLATE_FILES = [
  'scripts/agent-session-state.js',
  'scripts/guardex-docker-loader.sh',
  'scripts/guardex-env.sh',
  'scripts/install-vscode-active-agents-extension.js',
  'github/pull.yml.example',
  'github/workflows/cr.yml',
  'vscode/guardex-active-agents/package.json',
  'vscode/guardex-active-agents/extension.js',
  'vscode/guardex-active-agents/session-schema.js',
  'vscode/guardex-active-agents/README.md',
];

const LEGACY_WORKFLOW_SHIM_SPECS = [
  { relativePath: 'scripts/agent-branch-start.sh', kind: 'shell', command: ['branch', 'start'] },
  { relativePath: 'scripts/agent-branch-finish.sh', kind: 'shell', command: ['branch', 'finish'] },
  { relativePath: 'scripts/agent-branch-merge.sh', kind: 'shell', command: ['branch', 'merge'] },
  { relativePath: 'scripts/codex-agent.sh', kind: 'shell', command: ['internal', 'run-shell', 'codexAgent'] },
  { relativePath: 'scripts/review-bot-watch.sh', kind: 'shell', command: ['internal', 'run-shell', 'reviewBot'] },
  { relativePath: 'scripts/agent-worktree-prune.sh', kind: 'shell', command: ['worktree', 'prune'] },
  { relativePath: 'scripts/agent-file-locks.py', kind: 'python', command: ['locks'] },
  { relativePath: 'scripts/openspec/init-plan-workspace.sh', kind: 'shell', command: ['internal', 'run-shell', 'planInit'] },
  { relativePath: 'scripts/openspec/init-change-workspace.sh', kind: 'shell', command: ['internal', 'run-shell', 'changeInit'] },
];

const LEGACY_WORKFLOW_SHIMS = LEGACY_WORKFLOW_SHIM_SPECS.map((entry) => entry.relativePath);

const MANAGED_TEMPLATE_DESTINATIONS = TEMPLATE_FILES.map((entry) => toDestinationPath(entry));
const MANAGED_TEMPLATE_SCRIPT_FILES = MANAGED_TEMPLATE_DESTINATIONS.filter((entry) =>
  entry.startsWith('scripts/'),
);

const LEGACY_MANAGED_REPO_FILES = [
  ...LEGACY_WORKFLOW_SHIMS,
  'scripts/agent-session-state.js',
  'scripts/guardex-docker-loader.sh',
  'scripts/install-vscode-active-agents-extension.js',
  'scripts/guardex-env.sh',
  'scripts/install-agent-git-hooks.sh',
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.githooks/post-merge',
  '.githooks/post-checkout',
  '.codex/skills/gitguardex/SKILL.md',
  '.codex/skills/guardex-merge-skills-to-dev/SKILL.md',
  '.claude/commands/gitguardex.md',
];

const REQUIRED_MANAGED_REPO_FILES = [
  ...MANAGED_TEMPLATE_DESTINATIONS,
  ...HOOK_NAMES.map((entry) => path.posix.join('.githooks', entry)),
  '.omx/state/agent-file-locks.json',
];

const LEGACY_MANAGED_PACKAGE_SCRIPTS = {
  'agent:codex': 'bash ./scripts/codex-agent.sh',
  'agent:branch:start': 'bash ./scripts/agent-branch-start.sh',
  'agent:branch:finish': 'bash ./scripts/agent-branch-finish.sh',
  'agent:branch:merge': 'bash ./scripts/agent-branch-merge.sh',
  'agent:cleanup': 'gx cleanup',
  'agent:hooks:install': 'bash ./scripts/install-agent-git-hooks.sh',
  'agent:locks:claim': 'python3 ./scripts/agent-file-locks.py claim',
  'agent:locks:allow-delete': 'python3 ./scripts/agent-file-locks.py allow-delete',
  'agent:locks:release': 'python3 ./scripts/agent-file-locks.py release',
  'agent:locks:status': 'python3 ./scripts/agent-file-locks.py status',
  'agent:plan:init': 'bash ./scripts/openspec/init-plan-workspace.sh',
  'agent:change:init': 'bash ./scripts/openspec/init-change-workspace.sh',
  'agent:protect:list': 'gx protect list',
  'agent:branch:sync': 'gx sync',
  'agent:branch:sync:check': 'gx sync --check',
  'agent:safety:setup': 'gx setup',
  'agent:safety:scan': 'gx status --strict',
  'agent:safety:fix': 'gx setup --repair',
  'agent:safety:doctor': 'gx doctor',
  'agent:docker:load': 'bash ./scripts/guardex-docker-loader.sh',
  'agent:review:watch': 'bash ./scripts/review-bot-watch.sh',
  'agent:finish': 'gx finish --all',
};

const PACKAGE_SCRIPT_ASSETS = {
  branchStart: path.join(TEMPLATE_ROOT, 'scripts', 'agent-branch-start.sh'),
  branchFinish: path.join(TEMPLATE_ROOT, 'scripts', 'agent-branch-finish.sh'),
  branchMerge: path.join(TEMPLATE_ROOT, 'scripts', 'agent-branch-merge.sh'),
  codexAgent: path.join(TEMPLATE_ROOT, 'scripts', 'codex-agent.sh'),
  reviewBot: path.join(TEMPLATE_ROOT, 'scripts', 'review-bot-watch.sh'),
  worktreePrune: path.join(TEMPLATE_ROOT, 'scripts', 'agent-worktree-prune.sh'),
  lockTool: path.join(TEMPLATE_ROOT, 'scripts', 'agent-file-locks.py'),
  planInit: path.join(TEMPLATE_ROOT, 'scripts', 'openspec', 'init-plan-workspace.sh'),
  changeInit: path.join(TEMPLATE_ROOT, 'scripts', 'openspec', 'init-change-workspace.sh'),
};

const USER_LEVEL_SKILL_ASSETS = [
  {
    source: path.join(TEMPLATE_ROOT, 'codex', 'skills', 'gitguardex', 'SKILL.md'),
    destination: path.join('.codex', 'skills', 'gitguardex', 'SKILL.md'),
  },
  {
    source: path.join(TEMPLATE_ROOT, 'codex', 'skills', 'guardex-merge-skills-to-dev', 'SKILL.md'),
    destination: path.join('.codex', 'skills', 'guardex-merge-skills-to-dev', 'SKILL.md'),
  },
  {
    source: path.join(TEMPLATE_ROOT, 'claude', 'commands', 'gitguardex.md'),
    destination: path.join('.claude', 'commands', 'gitguardex.md'),
  },
];

const EXECUTABLE_RELATIVE_PATHS = new Set([
  ...MANAGED_TEMPLATE_SCRIPT_FILES,
  ...HOOK_NAMES.map((entry) => path.posix.join('.githooks', entry)),
]);

const CRITICAL_GUARDRAIL_PATHS = new Set([
  'AGENTS.md',
  ...HOOK_NAMES.map((entry) => path.posix.join('.githooks', entry)),
  'scripts/guardex-env.sh',
]);

const LOCK_FILE_RELATIVE = '.omx/state/agent-file-locks.json';
const AGENTS_BOTS_STATE_RELATIVE = '.omx/state/agents-bots.json';
const AGENTS_MARKER_START = '<!-- multiagent-safety:START -->';
const AGENTS_MARKER_END = '<!-- multiagent-safety:END -->';
const GITIGNORE_MARKER_START = '# multiagent-safety:START';
const GITIGNORE_MARKER_END = '# multiagent-safety:END';
const CODEX_WORKTREE_RELATIVE_DIR = path.join('.omx', 'agent-worktrees');
const CLAUDE_WORKTREE_RELATIVE_DIR = path.join('.omc', 'agent-worktrees');
const AGENT_WORKTREE_RELATIVE_DIRS = [
  CODEX_WORKTREE_RELATIVE_DIR,
  CLAUDE_WORKTREE_RELATIVE_DIR,
];
const MANAGED_GITIGNORE_PATHS = [
  '.omx/',
  '.omc/',
  '!.vscode/',
  '.vscode/*',
  '!.vscode/settings.json',
  'scripts/agent-session-state.js',
  'scripts/guardex-docker-loader.sh',
  'scripts/guardex-env.sh',
  'scripts/install-vscode-active-agents-extension.js',
  '.githooks',
  'oh-my-codex/',
  LOCK_FILE_RELATIVE,
];
const REPO_SCAFFOLD_DIRECTORIES = ['bin'];
const OMX_SCAFFOLD_DIRECTORIES = [
  '.omx',
  '.omx/state',
  '.omx/logs',
  '.omx/plans',
  CODEX_WORKTREE_RELATIVE_DIR,
  '.omc',
  CLAUDE_WORKTREE_RELATIVE_DIR,
];
const OMX_SCAFFOLD_FILES = new Map([
  ['.omx/notepad.md', '\n\n## WORKING MEMORY\n'],
  ['.omx/project-memory.json', '{}\n'],
]);
const TARGETED_FORCEABLE_MANAGED_PATHS = new Set([
  'AGENTS.md',
  '.gitignore',
  ...Array.from(OMX_SCAFFOLD_FILES.keys()),
  ...REQUIRED_MANAGED_REPO_FILES,
  ...LEGACY_WORKFLOW_SHIMS,
]);
const COMMAND_TYPO_ALIASES = new Map([
  ['relaese', 'release'],
  ['realaese', 'release'],
  ['relase', 'release'],
  ['setpu', 'setup'],
  ['inti', 'init'],
  ['intsall', 'install'],
  ['docter', 'doctor'],
  ['doctro', 'doctor'],
  ['cleunup', 'cleanup'],
  ['scna', 'scan'],
]);
const SUGGESTIBLE_COMMANDS = [
  'status',
  'setup',
  'doctor',
  'branch',
  'locks',
  'worktree',
  'hook',
  'migrate',
  'install-agent-skills',
  'agents',
  'merge',
  'finish',
  'report',
  'protect',
  'sync',
  'cleanup',
  'prompt',
  'help',
  'version',
  'init',
  'install',
  'fix',
  'scan',
  'review',
  'copy-prompt',
  'copy-commands',
  'print-agents-snippet',
  'release',
];
const CLI_COMMAND_DESCRIPTIONS = [
  ['status', 'Show GitGuardex CLI + service health without modifying files'],
  ['setup', 'Install, repair, and verify guardrails (flags: --repair, --install-only, --target, --current)'],
  ['doctor', 'Repair drift + verify (flags: --target, --current; auto-sandboxes on protected main)'],
  ['branch', 'CLI-owned branch workflow surface (start/finish/merge)'],
  ['locks', 'CLI-owned file lock surface (claim/allow-delete/release/status/validate)'],
  ['worktree', 'CLI-owned worktree cleanup surface (prune)'],
  ['hook', 'Hook dispatch/install surface used by managed shims'],
  ['migrate', 'Convert legacy repo-local installs to the zero-copy CLI-owned surface'],
  ['install-agent-skills', 'Install Guardex Codex/Claude skills into the user home'],
  ['protect', 'Manage protected branches (list/add/remove/set/reset)'],
  ['merge', 'Create/reuse an integration lane and merge overlapping agent branches'],
  ['sync', 'Sync agent branches with origin/<base>'],
  ['finish', 'Commit + PR + merge completed agent branches (--all, --branch)'],
  ['cleanup', 'Prune merged/stale agent branches and worktrees'],
  ['release', 'Create or update the current GitHub release with README-generated notes'],
  ['agents', 'Start/stop repo-scoped review + cleanup bots'],
  ['prompt', 'Print AI setup checklist (--exec, --snippet)'],
  ['report', 'Security/safety reports (e.g. OpenSSF scorecard)'],
  ['help', 'Show this help output'],
  ['version', 'Print GitGuardex version'],
];
const DEPRECATED_COMMAND_ALIASES = new Map([
  ['init', { target: 'setup', hint: 'gx setup' }],
  ['install', { target: 'setup', hint: 'gx setup --install-only' }],
  ['fix', { target: 'setup', hint: 'gx setup --repair' }],
  ['scan', { target: 'status', hint: 'gx status --strict' }],
  ['copy-prompt', { target: 'prompt', hint: 'gx prompt' }],
  ['copy-commands', { target: 'prompt', hint: 'gx prompt --exec' }],
  ['print-agents-snippet', { target: 'prompt', hint: 'gx prompt --snippet' }],
  ['review', { target: 'agents', hint: 'gx agents start (runs review + cleanup)' }],
]);
const AGENT_BOT_DESCRIPTIONS = [
  ['agents', 'Start/stop review + cleanup bots for this repo'],
];
const DOCTOR_AUTO_FINISH_DETAIL_LIMIT = 6;
const DOCTOR_AUTO_FINISH_BRANCH_LABEL_MAX = 72;
const DOCTOR_AUTO_FINISH_MESSAGE_MAX = 160;

function envFlagIsTruthy(raw) {
  const lowered = String(raw || '').trim().toLowerCase();
  return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on';
}

function isClaudeCodeSession(env = process.env) {
  return envFlagIsTruthy(env.CLAUDECODE) || Boolean(env.CLAUDE_CODE_SESSION_ID);
}

function defaultAgentWorktreeRelativeDir(env = process.env) {
  return isClaudeCodeSession(env) ? CLAUDE_WORKTREE_RELATIVE_DIR : CODEX_WORKTREE_RELATIVE_DIR;
}

const AI_SETUP_PROMPT = `GitGuardex (gx) setup checklist for Codex/Claude in this repo.

1) Install:    ${GLOBAL_INSTALL_COMMAND} && gh --version
2) Bootstrap:  gx setup
3) Repair:     gx doctor
4) Task loop:  gx branch start "<task>" "<agent>"
               then gx locks claim --branch "<agent-branch>" <file...> -> gx branch finish
5) Integrate:  gx merge --branch <agent-a> --branch <agent-b>
6) Finish:     gx finish --all
7) Cleanup:    gx cleanup
8) OpenSpec:   /opsx:propose -> /opsx:apply -> /opsx:archive
9) Optional:   gx protect add release staging
10) Optional:  gx sync --check && gx sync
11) Review bot: install https://github.com/apps/cr-gpt + set OPENAI_API_KEY
12) Fork sync:  install https://github.com/apps/pull + cp .github/pull.yml.example .github/pull.yml
`;

const AI_SETUP_COMMANDS = `${GLOBAL_INSTALL_COMMAND}
gh --version
gx setup
gx doctor
gx branch start "<task>" "<agent>"
gx locks claim --branch "<agent-branch>" <file...>
gx merge --branch "<agent-a>" --branch "<agent-b>"
gx finish --all
gx cleanup
gx protect add release staging
gx sync --check && gx sync
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

module.exports = {
  fs,
  os,
  path,
  cp,
  PACKAGE_ROOT,
  CLI_ENTRY_PATH,
  packageJsonPath,
  packageJson,
  TOOL_NAME,
  SHORT_TOOL_NAME,
  LEGACY_NAMES,
  GLOBAL_INSTALL_COMMAND,
  OPENSPEC_PACKAGE,
  OMC_PACKAGE,
  OMC_REPO_URL,
  CAVEMEM_PACKAGE,
  NPX_BIN,
  GUARDEX_HOME_DIR,
  GLOBAL_TOOLCHAIN_SERVICES,
  GLOBAL_TOOLCHAIN_PACKAGES,
  OPTIONAL_LOCAL_COMPANION_TOOLS,
  GH_BIN,
  REQUIRED_SYSTEM_TOOLS,
  MAINTAINER_RELEASE_REPO,
  NPM_BIN,
  OPENSPEC_BIN,
  SCORECARD_BIN,
  GIT_PROTECTED_BRANCHES_KEY,
  GIT_BASE_BRANCH_KEY,
  GIT_SYNC_STRATEGY_KEY,
  GUARDEX_REPO_TOGGLE_ENV,
  DEFAULT_PROTECTED_BRANCHES,
  DEFAULT_BASE_BRANCH,
  DEFAULT_SYNC_STRATEGY,
  DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES,
  COMPOSE_HINT_FILES,
  TEMPLATE_ROOT,
  HOOK_NAMES,
  toDestinationPath,
  TEMPLATE_FILES,
  LEGACY_WORKFLOW_SHIM_SPECS,
  LEGACY_WORKFLOW_SHIMS,
  MANAGED_TEMPLATE_DESTINATIONS,
  MANAGED_TEMPLATE_SCRIPT_FILES,
  LEGACY_MANAGED_REPO_FILES,
  REQUIRED_MANAGED_REPO_FILES,
  LEGACY_MANAGED_PACKAGE_SCRIPTS,
  PACKAGE_SCRIPT_ASSETS,
  USER_LEVEL_SKILL_ASSETS,
  EXECUTABLE_RELATIVE_PATHS,
  CRITICAL_GUARDRAIL_PATHS,
  LOCK_FILE_RELATIVE,
  AGENTS_BOTS_STATE_RELATIVE,
  AGENTS_MARKER_START,
  AGENTS_MARKER_END,
  GITIGNORE_MARKER_START,
  GITIGNORE_MARKER_END,
  CODEX_WORKTREE_RELATIVE_DIR,
  CLAUDE_WORKTREE_RELATIVE_DIR,
  AGENT_WORKTREE_RELATIVE_DIRS,
  MANAGED_GITIGNORE_PATHS,
  REPO_SCAFFOLD_DIRECTORIES,
  OMX_SCAFFOLD_DIRECTORIES,
  OMX_SCAFFOLD_FILES,
  TARGETED_FORCEABLE_MANAGED_PATHS,
  COMMAND_TYPO_ALIASES,
  SUGGESTIBLE_COMMANDS,
  CLI_COMMAND_DESCRIPTIONS,
  DEPRECATED_COMMAND_ALIASES,
  AGENT_BOT_DESCRIPTIONS,
  DOCTOR_AUTO_FINISH_DETAIL_LIMIT,
  DOCTOR_AUTO_FINISH_BRANCH_LABEL_MAX,
  DOCTOR_AUTO_FINISH_MESSAGE_MAX,
  envFlagIsTruthy,
  isClaudeCodeSession,
  defaultAgentWorktreeRelativeDir,
  AI_SETUP_PROMPT,
  AI_SETUP_COMMANDS,
  SCORECARD_RISK_BY_CHECK,
};
