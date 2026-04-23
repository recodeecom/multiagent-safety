const {
  path,
  DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES,
  TARGETED_FORCEABLE_MANAGED_PATHS,
} = require('../context');
const { DEFAULT_NESTED_REPO_MAX_DEPTH } = require('../git');

function requireValue(rawArgs, index, flagName) {
  const value = rawArgs[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${flagName} requires a value`);
  }
  return value;
}

function normalizeManagedForcePath(rawPath) {
  if (typeof rawPath !== 'string') {
    return null;
  }
  const normalized = path.posix.normalize(rawPath.replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    return null;
  }
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

function collectForceManagedPaths(rawArgs, startIndex) {
  const forceManagedPaths = [];
  let nextIndex = startIndex;

  while (nextIndex + 1 < rawArgs.length) {
    const candidate = rawArgs[nextIndex + 1];
    if (!candidate || candidate.startsWith('-')) {
      break;
    }
    const normalized = normalizeManagedForcePath(candidate);
    if (!normalized || !TARGETED_FORCEABLE_MANAGED_PATHS.has(normalized)) {
      throw new Error(`Unknown managed path after --force: ${candidate}`);
    }
    forceManagedPaths.push(normalized);
    nextIndex += 1;
  }

  return { forceManagedPaths, nextIndex };
}

function parseCommonArgs(rawArgs, defaults) {
  const options = { ...defaults };
  const supportsForce = Object.prototype.hasOwnProperty.call(options, 'force');
  if (supportsForce && !Array.isArray(options.forceManagedPaths)) {
    options.forceManagedPaths = [];
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--target' || arg === '-t') {
      options.target = requireValue(rawArgs, index, '--target');
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
      if (!supportsForce) {
        throw new Error(`Unknown option: ${arg}`);
      }
      options.force = true;
      const parsed = collectForceManagedPaths(rawArgs, index);
      if (parsed.forceManagedPaths.length > 0) {
        options.forceManagedPaths = Array.from(
          new Set([...(options.forceManagedPaths || []), ...parsed.forceManagedPaths]),
        );
      }
      index = parsed.nextIndex;
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
    if (arg === '--allow-protected-base-write') {
      options.allowProtectedBaseWrite = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'waitForMerge') && arg === '--wait-for-merge') {
      options.waitForMerge = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'waitForMerge') && arg === '--no-wait-for-merge') {
      options.waitForMerge = false;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.target) {
    throw new Error('--target requires a path value');
  }

  return options;
}

function parseRepoTraversalArgs(rawArgs, defaults) {
  const traversalDefaults = {
    ...defaults,
    recursive: true,
    nestedMaxDepth: DEFAULT_NESTED_REPO_MAX_DEPTH,
    nestedSkipDirs: [],
    includeSubmodules: false,
  };
  const forwardedArgs = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--no-recursive' || arg === '--no-nested' || arg === '--single-repo' || arg === '--current') {
      traversalDefaults.recursive = false;
      continue;
    }
    if (arg === '--recursive' || arg === '--nested') {
      traversalDefaults.recursive = true;
      continue;
    }
    if (arg === '--max-depth') {
      const raw = requireValue(rawArgs, index, '--max-depth');
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error('--max-depth requires a positive integer');
      }
      traversalDefaults.nestedMaxDepth = parsed;
      index += 1;
      continue;
    }
    if (arg === '--skip-nested') {
      const raw = requireValue(rawArgs, index, '--skip-nested');
      traversalDefaults.nestedSkipDirs.push(raw);
      index += 1;
      continue;
    }
    if (arg === '--include-submodules') {
      traversalDefaults.includeSubmodules = true;
      continue;
    }
    forwardedArgs.push(arg);
  }

  return parseCommonArgs(forwardedArgs, traversalDefaults);
}

function parseSetupArgs(rawArgs, defaults) {
  const setupDefaults = {
    ...defaults,
    parentWorkspaceView: false,
  };
  const forwardedArgs = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--parent-workspace-view') {
      setupDefaults.parentWorkspaceView = true;
      continue;
    }
    if (arg === '--no-parent-workspace-view') {
      setupDefaults.parentWorkspaceView = false;
      continue;
    }
    forwardedArgs.push(arg);
  }

  return parseRepoTraversalArgs(forwardedArgs, setupDefaults);
}

function parseDoctorArgs(rawArgs) {
  const doctorDefaults = {
    target: process.cwd(),
    force: false,
    dropStaleLocks: true,
    skipAgents: false,
    skipPackageJson: false,
    skipGitignore: false,
    dryRun: false,
    json: false,
    allowProtectedBaseWrite: false,
    waitForMerge: true,
    verboseAutoFinish: false,
  };
  const forwardedArgs = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--verbose-auto-finish') {
      doctorDefaults.verboseAutoFinish = true;
      continue;
    }
    if (arg === '--compact-auto-finish') {
      doctorDefaults.verboseAutoFinish = false;
      continue;
    }
    forwardedArgs.push(arg);
  }

  return parseRepoTraversalArgs(forwardedArgs, doctorDefaults);
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

function parseReviewArgs(rawArgs) {
  const parsed = parseTargetFlag(rawArgs, process.cwd());
  const passthroughArgs = [...parsed.args];
  if (passthroughArgs[0] === 'start') {
    passthroughArgs.shift();
  }
  return {
    target: parsed.target,
    passthroughArgs,
  };
}

function parseAgentsArgs(rawArgs) {
  const parsed = parseTargetFlag(rawArgs, process.cwd());
  const [subcommandRaw = '', ...rest] = parsed.args;
  const subcommand = subcommandRaw || 'status';
  const options = {
    target: parsed.target,
    subcommand,
    reviewIntervalSeconds: 30,
    cleanupIntervalSeconds: 60,
    idleMinutes: DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES,
    pid: null,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--review-interval') {
      const next = rest[index + 1];
      if (!next) {
        throw new Error('--review-interval requires an integer seconds value');
      }
      const parsedValue = Number.parseInt(next, 10);
      if (!Number.isInteger(parsedValue) || parsedValue < 5) {
        throw new Error('--review-interval must be an integer >= 5 seconds');
      }
      options.reviewIntervalSeconds = parsedValue;
      index += 1;
      continue;
    }
    if (arg === '--cleanup-interval') {
      const next = rest[index + 1];
      if (!next) {
        throw new Error('--cleanup-interval requires an integer seconds value');
      }
      const parsedValue = Number.parseInt(next, 10);
      if (!Number.isInteger(parsedValue) || parsedValue < 5) {
        throw new Error('--cleanup-interval must be an integer >= 5 seconds');
      }
      options.cleanupIntervalSeconds = parsedValue;
      index += 1;
      continue;
    }
    if (arg === '--idle-minutes') {
      const next = rest[index + 1];
      if (!next) {
        throw new Error('--idle-minutes requires an integer minutes value');
      }
      const parsedValue = Number.parseInt(next, 10);
      if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        throw new Error('--idle-minutes must be an integer >= 1');
      }
      options.idleMinutes = parsedValue;
      index += 1;
      continue;
    }
    if (arg === '--pid') {
      const next = rest[index + 1];
      if (!next) {
        throw new Error('--pid requires a positive integer value');
      }
      const parsedValue = Number.parseInt(next, 10);
      if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error('--pid must be a positive integer');
      }
      options.pid = parsedValue;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!['start', 'stop', 'status'].includes(options.subcommand)) {
    throw new Error(`Unknown agents subcommand: ${options.subcommand}`);
  }
  if (options.pid !== null && options.subcommand !== 'stop') {
    throw new Error('--pid is only supported with `gx agents stop`');
  }

  return options;
}

function parseReportArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    subcommand: '',
    repo: '',
    scorecardJson: '',
    outputDir: '',
    date: '',
    taskSize: '',
    tokens: '',
    execCount: '',
    writeStdinCount: '',
    completionBeforeTail: '',
    expectedBound: '',
    fragmentation: '',
    finishPath: '',
    postProof: '',
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
    if (arg === '--task-size') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--task-size requires a value');
      options.taskSize = next;
      index += 1;
      continue;
    }
    if (arg === '--tokens') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--tokens requires a value');
      options.tokens = next;
      index += 1;
      continue;
    }
    if (arg === '--exec-count') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--exec-count requires a value');
      options.execCount = next;
      index += 1;
      continue;
    }
    if (arg === '--write-stdin-count') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--write-stdin-count requires a value');
      options.writeStdinCount = next;
      index += 1;
      continue;
    }
    if (arg === '--completion-before-tail') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--completion-before-tail requires yes or no');
      options.completionBeforeTail = next;
      index += 1;
      continue;
    }
    if (arg === '--expected-bound') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--expected-bound requires a value');
      options.expectedBound = next;
      index += 1;
      continue;
    }
    if (arg === '--fragmentation') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--fragmentation requires a value');
      options.fragmentation = next;
      index += 1;
      continue;
    }
    if (arg === '--finish-path') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--finish-path requires a value');
      options.finishPath = next;
      index += 1;
      continue;
    }
    if (arg === '--post-proof') {
      const next = rawArgs[index + 1];
      if (!next) throw new Error('--post-proof requires a value');
      options.postProof = next;
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

  return options;
}

function parseCleanupArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    base: '',
    branch: '',
    dryRun: false,
    forceDirty: false,
    keepRemote: false,
    keepCleanWorktrees: false,
    includePrMerged: false,
    idleMinutes: 0,
    watch: false,
    intervalSeconds: 60,
    once: false,
    maxBranches: 0,
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
    if (arg === '--branch') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--branch requires an agent branch value');
      }
      options.branch = next;
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--force-dirty') {
      options.forceDirty = true;
      continue;
    }
    if (arg === '--keep-remote') {
      options.keepRemote = true;
      continue;
    }
    if (arg === '--keep-clean-worktrees') {
      options.keepCleanWorktrees = true;
      continue;
    }
    if (arg === '--include-pr-merged') {
      options.includePrMerged = true;
      continue;
    }
    if (arg === '--idle-minutes') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--idle-minutes requires an integer value');
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('--idle-minutes must be an integer >= 0');
      }
      options.idleMinutes = parsed;
      index += 1;
      continue;
    }
    if (arg === '--watch') {
      options.watch = true;
      continue;
    }
    if (arg === '--interval') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--interval requires an integer seconds value');
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isInteger(parsed) || parsed < 5) {
        throw new Error('--interval must be an integer >= 5 seconds');
      }
      options.intervalSeconds = parsed;
      index += 1;
      continue;
    }
    if (arg === '--once') {
      options.once = true;
      continue;
    }
    if (arg === '--max-branches') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--max-branches requires an integer value');
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('--max-branches must be an integer >= 1');
      }
      options.maxBranches = parsed;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.watch && options.idleMinutes === 0) {
    options.idleMinutes = DEFAULT_SHADOW_CLEANUP_IDLE_MINUTES;
  }

  return options;
}

function parseMergeArgs(rawArgs) {
  const options = {
    target: process.cwd(),
    base: '',
    into: '',
    branches: [],
    task: '',
    agent: '',
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
    if (arg === '--into') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--into requires an agent/* branch value');
      }
      options.into = next;
      index += 1;
      continue;
    }
    if (arg === '--branch') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--branch requires an agent/* branch value');
      }
      options.branches.push(next);
      index += 1;
      continue;
    }
    if (arg === '--task') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--task requires a task value');
      }
      options.task = next;
      index += 1;
      continue;
    }
    if (arg === '--agent') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--agent requires an agent value');
      }
      options.agent = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.branches.length === 0) {
    throw new Error('merge requires at least one --branch <agent/*> input');
  }

  return options;
}

function parseFinishArgs(rawArgs, defaults = {}) {
  const options = {
    target: process.cwd(),
    base: '',
    branch: '',
    all: false,
    dryRun: false,
    waitForMerge: defaults.waitForMerge ?? true,
    cleanup: defaults.cleanup ?? true,
    keepRemote: false,
    noAutoCommit: false,
    parentGitlinkCommit: defaults.parentGitlinkCommit ?? true,
    failFast: false,
    commitMessage: '',
    mergeMode: defaults.mergeMode || 'pr',
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
    if (arg === '--branch') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--branch requires an agent/* branch value');
      }
      options.branch = next;
      index += 1;
      continue;
    }
    if (arg === '--commit-message') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--commit-message requires a value');
      }
      options.commitMessage = next;
      index += 1;
      continue;
    }
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--wait-for-merge') {
      options.waitForMerge = true;
      continue;
    }
    if (arg === '--no-wait-for-merge') {
      options.waitForMerge = false;
      continue;
    }
    if (arg === '--via-pr') {
      options.mergeMode = 'pr';
      continue;
    }
    if (arg === '--direct-only') {
      options.mergeMode = 'direct';
      continue;
    }
    if (arg === '--mode') {
      const next = rawArgs[index + 1];
      if (!next) {
        throw new Error('--mode requires a value');
      }
      if (!['auto', 'direct', 'pr'].includes(next)) {
        throw new Error(`Invalid --mode value: ${next} (expected auto|direct|pr)`);
      }
      options.mergeMode = next;
      index += 1;
      continue;
    }
    if (arg === '--cleanup') {
      options.cleanup = true;
      continue;
    }
    if (arg === '--no-cleanup') {
      options.cleanup = false;
      continue;
    }
    if (arg === '--keep-remote') {
      options.keepRemote = true;
      continue;
    }
    if (arg === '--no-auto-commit') {
      options.noAutoCommit = true;
      continue;
    }
    if (arg === '--parent-gitlink-commit') {
      options.parentGitlinkCommit = true;
      continue;
    }
    if (arg === '--no-parent-gitlink-commit') {
      options.parentGitlinkCommit = false;
      continue;
    }
    if (arg === '--fail-fast') {
      options.failFast = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.branch && !options.branch.startsWith('agent/')) {
    throw new Error(`--branch must reference an agent/* branch (received: ${options.branch})`);
  }

  return options;
}

module.exports = {
  requireValue,
  normalizeManagedForcePath,
  collectForceManagedPaths,
  parseCommonArgs,
  parseRepoTraversalArgs,
  parseSetupArgs,
  parseDoctorArgs,
  parseTargetFlag,
  parseReviewArgs,
  parseAgentsArgs,
  parseReportArgs,
  parseSyncArgs,
  parseCleanupArgs,
  parseMergeArgs,
  parseFinishArgs,
};
