#!/usr/bin/env node

const hooksModule = require('../hooks');
const sandboxModule = require('../sandbox');
const toolchainModule = require('../toolchain');
const finishModule = require('../finish');
const {
  fs,
  path,
  cp,
  packageJson,
  TOOL_NAME,
  SHORT_TOOL_NAME,
  OPENSPEC_PACKAGE,
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
  COMPOSE_HINT_FILES,
  TEMPLATE_ROOT,
  HOOK_NAMES,
  TEMPLATE_FILES,
  LEGACY_WORKFLOW_SHIM_SPECS,
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
  AGENT_WORKTREE_RELATIVE_DIRS,
  MANAGED_GITIGNORE_PATHS,
  REPO_SCAFFOLD_DIRECTORIES,
  OMX_SCAFFOLD_DIRECTORIES,
  OMX_SCAFFOLD_FILES,
  TARGETED_FORCEABLE_MANAGED_PATHS,
  DEPRECATED_COMMAND_ALIASES,
  defaultAgentWorktreeRelativeDir,
  AI_SETUP_PROMPT,
  AI_SETUP_COMMANDS,
  SCORECARD_RISK_BY_CHECK,
} = require('../context');
const {
  gitRun,
  resolveRepoRoot,
  isGitRepo,
  discoverNestedGitRepos,
} = require('../git');
const {
  run,
  extractTargetedArgs,
  packageAssetEnv,
  runPackageAsset,
  runReviewBotCommand,
  invokePackageAsset,
} = require('../core/runtime');
const {
  normalizeManagedForcePath,
  parseCommonArgs,
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
} = require('./args');
const {
  maybeSuggestCommand,
  normalizeCommandOrThrow,
  warnDeprecatedAlias,
  extractFlag,
} = require('./dispatch');
const {
  runtimeVersion,
  colorize,
  colorizeDoctorOutput,
  statusDot,
  printToolLogsSummary,
  usage,
  formatElapsedDuration,
  compactAutoFinishPathSegments,
  detectRecoverableAutoFinishConflict,
  printAutoFinishSummary,
} = require('../output');
const {
  toDestinationPath,
  ensureParentDir,
  ensureExecutable,
  isCriticalGuardrailPath,
  shellSingleQuote,
  renderShellDispatchShim,
  renderPythonDispatchShim,
  managedForceConflictMessage,
  printOperations,
  printStandaloneOperations,
} = require('../scaffold');

let sandboxApi;
let toolchainApi;
let finishApi;

const SHARED_VSCODE_SETTINGS_RELATIVE = path.posix.join('.vscode', 'settings.json');
const REPO_SCAN_IGNORED_FOLDERS_SETTING = 'git.repositoryScanIgnoredFolders';
const MANAGED_REPO_SCAN_IGNORED_FOLDERS = [
  '.omx/agent-worktrees',
  '**/.omx/agent-worktrees',
  '.omc/agent-worktrees',
  '**/.omc/agent-worktrees',
];

function getSandboxApi() {
  if (!sandboxApi) {
    sandboxApi = sandboxModule.createSandboxApi({
      protectedBaseWriteBlock,
      runInstallInternal,
      ensureSetupProtectedBranches,
      ensureParentWorkspaceView,
      buildParentWorkspaceView,
      runFixInternal,
    });
  }
  return sandboxApi;
}

function getToolchainApi() {
  if (!toolchainApi) {
    toolchainApi = toolchainModule.createToolchainApi({
      TOOL_NAME,
      NPM_BIN,
      NPX_BIN,
      packageJson,
      OPENSPEC_PACKAGE,
      OPENSPEC_BIN,
      GLOBAL_TOOLCHAIN_PACKAGES,
      parseAutoApproval,
      isInteractiveTerminal,
      promptYesNoStrict,
      run,
      checkForGuardexUpdate,
      printUpdateAvailableBanner,
      readInstalledGuardexVersion,
      restartIntoUpdatedGuardex,
      checkForOpenSpecPackageUpdate,
      printOpenSpecUpdateAvailableBanner,
      resolveGlobalInstallApproval,
      detectGlobalToolchainPackages,
      detectOptionalLocalCompanionTools,
      formatGlobalToolchainServiceName,
      askGlobalInstallForMissing,
    });
  }
  return toolchainApi;
}

function getFinishApi() {
  if (!finishApi) {
    finishApi = finishModule.createFinishApi({
      TOOL_NAME,
      LOCK_FILE_RELATIVE,
      path,
      fs,
      run,
      runPackageAsset,
      resolveRepoRoot,
      parseCleanupArgs,
      parseMergeArgs,
      parseFinishArgs,
      parseSyncArgs,
      listAgentWorktrees,
      listLocalAgentBranchesForFinish,
      uniquePreserveOrder,
      branchExists,
      resolveFinishBaseBranch,
      worktreeHasLocalChanges,
      branchMergedIntoBase,
      autoCommitWorktreeForFinish,
      resolveBaseBranch,
      resolveSyncStrategy,
      ensureOriginBaseRef,
      gitRun,
      currentBranchName,
      workingTreeIsDirty,
      aheadBehind,
      lockRegistryStatus,
      syncOperation,
    });
  }
  return finishApi;
}

/**
 * @typedef {Object} AutoFinishSummary
 * @property {boolean} [enabled]
 * @property {number} [attempted]
 * @property {number} [completed]
 * @property {number} [skipped]
 * @property {number} [failed]
 * @property {string[]} [details]
 * @property {string} [baseBranch]
 */

/**
 * @typedef {Object} OperationResult
 * @property {string} status
 * @property {string} note
 * @property {string} [stdout]
 * @property {string} [stderr]
 * @property {string} [prUrl]
 * @property {string[]} [stagedFiles]
 * @property {string} [commitMessage]
 * @property {unknown[]} [operations]
 * @property {OperationResult} [cleanup]
 * @property {OperationResult} [hookRefresh]
 */

/**
 * @typedef {Object} SandboxMetadata
 * @property {string} branch
 * @property {string} worktreePath
 */

/**
 * @typedef {Object} SandboxStartResult
 * @property {SandboxMetadata} metadata
 * @property {string} [stdout]
 * @property {string} [stderr]
 */

/**
 * @typedef {Object} DoctorLockSyncState
 * @property {OperationResult} result
 * @property {string | null} sandboxLockContent
 */

/**
 * @typedef {Object} DoctorSandboxExecution
 * @property {OperationResult} autoCommit
 * @property {OperationResult} finish
 * @property {OperationResult} protectedBaseRepairSync
 * @property {OperationResult} lockSync
 * @property {OperationResult} omxScaffoldSync
 * @property {AutoFinishSummary} autoFinish
 * @property {string | null} sandboxLockContent
 */
function renderManagedFile(repoRoot, relativePath, content, options = {}) {
  const destinationPath = path.join(repoRoot, relativePath);
  const destinationExists = fs.existsSync(destinationPath);
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);

  if (destinationExists) {
    const existingContent = fs.readFileSync(destinationPath, 'utf8');
    if (existingContent === content) {
      ensureExecutable(destinationPath, relativePath, dryRun);
      return { status: 'unchanged', file: relativePath };
    }
    if (!force && !isCriticalGuardrailPath(relativePath)) {
      throw new Error(managedForceConflictMessage(relativePath));
    }
  }

  ensureParentDir(repoRoot, destinationPath, dryRun);
  if (!dryRun) {
    fs.writeFileSync(destinationPath, content, 'utf8');
    ensureExecutable(destinationPath, relativePath, dryRun);
  }

  if (destinationExists && !force && isCriticalGuardrailPath(relativePath)) {
    return { status: dryRun ? 'would-repair-critical' : 'repaired-critical', file: relativePath };
  }

  return { status: destinationExists ? 'overwritten' : 'created', file: relativePath };
}

function ensureGeneratedScriptShim(repoRoot, spec, options = {}) {
  const content = spec.kind === 'python'
    ? renderPythonDispatchShim(spec.command)
    : renderShellDispatchShim(spec.command);
  return renderManagedFile(repoRoot, spec.relativePath, content, options);
}

function ensureHookShim(repoRoot, hookName, options = {}) {
  return renderManagedFile(
    repoRoot,
    path.posix.join('.githooks', hookName),
    renderShellDispatchShim(['hook', 'run', hookName]),
    options,
  );
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
    if (!force && !isCriticalGuardrailPath(destinationRelativePath)) {
      throw new Error(managedForceConflictMessage(destinationRelativePath));
    }
  }

  ensureParentDir(repoRoot, destinationPath, dryRun);
  if (!dryRun) {
    fs.writeFileSync(destinationPath, sourceContent, 'utf8');
    ensureExecutable(destinationPath, destinationRelativePath, dryRun);
  }

  if (destinationExists && !force && isCriticalGuardrailPath(destinationRelativePath)) {
    return { status: dryRun ? 'would-repair-critical' : 'repaired-critical', file: destinationRelativePath };
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

    if (isCriticalGuardrailPath(destinationRelativePath)) {
      if (!dryRun) {
        fs.writeFileSync(destinationPath, sourceContent, 'utf8');
        ensureExecutable(destinationPath, destinationRelativePath, dryRun);
      }
      return { status: dryRun ? 'would-repair-critical' : 'repaired-critical', file: destinationRelativePath };
    }

    // In fix mode, avoid silently replacing local customizations.
    return { status: 'skipped-conflict', file: destinationRelativePath };
  }

  ensureParentDir(repoRoot, destinationPath, dryRun);
  if (!dryRun) {
    fs.writeFileSync(destinationPath, sourceContent, 'utf8');
    ensureExecutable(destinationPath, destinationRelativePath, dryRun);
  }

  return { status: 'created', file: destinationRelativePath };
}

function ensureTargetedLegacyWorkflowShims(repoRoot, options) {
  const targetedPaths = Array.isArray(options.forceManagedPaths) ? options.forceManagedPaths : [];
  if (targetedPaths.length === 0) {
    return [];
  }

  const operations = [];
  for (const shim of LEGACY_WORKFLOW_SHIM_SPECS) {
    if (!shouldForceManagedPath(options, shim.relativePath)) {
      continue;
    }
    operations.push(ensureGeneratedScriptShim(repoRoot, shim, { dryRun: options.dryRun, force: true }));
  }
  return operations;
}

function lockFilePath(repoRoot) {
  return path.join(repoRoot, LOCK_FILE_RELATIVE);
}

function ensureOmxScaffold(repoRoot, dryRun) {
  const operations = [];

  for (const relativeDir of REPO_SCAFFOLD_DIRECTORIES) {
    const absoluteDir = path.join(repoRoot, relativeDir);
    if (fs.existsSync(absoluteDir)) {
      if (!fs.statSync(absoluteDir).isDirectory()) {
        throw new Error(`Expected directory at ${relativeDir} but found a file.`);
      }
      operations.push({ status: 'unchanged', file: relativeDir });
      continue;
    }

    if (!dryRun) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }
    operations.push({ status: 'created', file: relativeDir });
  }

  for (const relativeDir of OMX_SCAFFOLD_DIRECTORIES) {
    const absoluteDir = path.join(repoRoot, relativeDir);
    if (fs.existsSync(absoluteDir)) {
      if (!fs.statSync(absoluteDir).isDirectory()) {
        throw new Error(`Expected directory at ${relativeDir} but found a file.`);
      }
      operations.push({ status: 'unchanged', file: relativeDir });
      continue;
    }

    if (!dryRun) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }
    operations.push({ status: 'created', file: relativeDir });
  }

  for (const [relativeFile, defaultContent] of OMX_SCAFFOLD_FILES.entries()) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    if (fs.existsSync(absoluteFile)) {
      if (!fs.statSync(absoluteFile).isFile()) {
        throw new Error(`Expected file at ${relativeFile} but found a directory.`);
      }
      operations.push({ status: 'unchanged', file: relativeFile });
      continue;
    }

    if (!dryRun) {
      fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
      fs.writeFileSync(absoluteFile, defaultContent, 'utf8');
    }
    operations.push({ status: 'created', file: relativeFile });
  }

  return operations;
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

function removeLegacyPackageScripts(repoRoot, dryRun) {
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

  const existingScripts = pkg.scripts && typeof pkg.scripts === 'object'
    ? pkg.scripts
    : {};
  pkg.scripts = existingScripts;
  let changed = false;
  for (const [key, value] of Object.entries(LEGACY_MANAGED_PACKAGE_SCRIPTS)) {
    if (existingScripts[key] === value) {
      delete existingScripts[key];
      changed = true;
    }
  }

  if (!changed) {
    return { status: 'unchanged', file: 'package.json', note: 'no Guardex-managed agent:* scripts found' };
  }

  if (!dryRun) {
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  return { status: dryRun ? 'would-update' : 'updated', file: 'package.json', note: 'removed Guardex-managed agent:* scripts' };
}

function installUserLevelAsset(asset, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const destinationPath = path.join(GUARDEX_HOME_DIR, asset.destination);
  const sourceContent = fs.readFileSync(asset.source, 'utf8');
  const destinationExists = fs.existsSync(destinationPath);

  if (destinationExists) {
    const existingContent = fs.readFileSync(destinationPath, 'utf8');
    if (existingContent === sourceContent) {
      return { status: 'unchanged', file: asset.destination };
    }
    if (!force) {
      return { status: 'skipped-conflict', file: asset.destination };
    }
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, sourceContent, 'utf8');
  }
  return { status: destinationExists ? (dryRun ? 'would-update' : 'updated') : 'created', file: asset.destination };
}

function removeLegacyManagedRepoFile(repoRoot, relativePath, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { status: 'unchanged', file: relativePath, note: 'not present' };
  }
  if (!fs.statSync(absolutePath).isFile()) {
    return { status: 'skipped-conflict', file: relativePath, note: 'not a regular file' };
  }

  const skillAsset = USER_LEVEL_SKILL_ASSETS.find((asset) => asset.destination === relativePath);
  if (skillAsset) {
    const userLevelPath = path.join(GUARDEX_HOME_DIR, skillAsset.destination);
    if (!fs.existsSync(userLevelPath)) {
      return { status: 'skipped', file: relativePath, note: 'user-level replacement not installed' };
    }
  }

  const templateRelative = skillAsset
    ? skillAsset.source.slice(TEMPLATE_ROOT.length + 1)
    : relativePath.replace(/^\./, '');
  const sourcePath = path.join(TEMPLATE_ROOT, templateRelative);
  if (!fs.existsSync(sourcePath)) {
    return { status: 'skipped', file: relativePath, note: 'template source missing' };
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const existingContent = fs.readFileSync(absolutePath, 'utf8');
  if (existingContent !== sourceContent && !force) {
    return { status: 'skipped-conflict', file: relativePath, note: 'local edits differ from managed template' };
  }

  if (!dryRun) {
    fs.rmSync(absolutePath, { force: true });
  }
  return { status: dryRun ? 'would-remove' : 'removed', file: relativePath };
}

function ensureAgentsSnippet(repoRoot, dryRun, options = {}) {
  const agentsPath = path.join(repoRoot, 'AGENTS.md');
  const snippet = fs.readFileSync(path.join(TEMPLATE_ROOT, 'AGENTS.multiagent-safety.md'), 'utf8').trimEnd();
  const managedRegex = new RegExp(
    `${AGENTS_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${AGENTS_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'm',
  );

  if (!fs.existsSync(agentsPath)) {
    if (!dryRun) {
      fs.writeFileSync(agentsPath, `# AGENTS\n\n${snippet}\n`, 'utf8');
    }
    return { status: 'created', file: 'AGENTS.md' };
  }

  const existing = fs.readFileSync(agentsPath, 'utf8');
  if (managedRegex.test(existing)) {
    const next = existing.replace(managedRegex, snippet);
    if (next === existing) {
      return { status: 'unchanged', file: 'AGENTS.md' };
    }
    if (!dryRun) {
      fs.writeFileSync(agentsPath, next, 'utf8');
    }
    return { status: 'updated', file: 'AGENTS.md', note: 'refreshed gitguardex-managed block' };
  }

  if (existing.includes(AGENTS_MARKER_START)) {
    return { status: 'unchanged', file: 'AGENTS.md', note: 'existing marker found without managed end marker' };
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
    return { status: 'created', file: '.gitignore', note: 'added gitguardex-managed entries' };
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
    return { status: 'updated', file: '.gitignore', note: 'refreshed gitguardex-managed entries' };
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  if (!dryRun) {
    fs.writeFileSync(gitignorePath, `${existing}${separator}${managedBlock}\n`, 'utf8');
  }
  return { status: 'updated', file: '.gitignore', note: 'appended gitguardex-managed entries' };
}

function stripJsonComments(source) {
  let result = '';
  let inString = false;
  let escapeNext = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (current === '\n' || current === '\r') {
        inLineComment = false;
        result += current;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
        continue;
      }
      if (current === '\n' || current === '\r') {
        result += current;
      }
      continue;
    }

    if (inString) {
      result += current;
      if (escapeNext) {
        escapeNext = false;
      } else if (current === '\\') {
        escapeNext = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += current;
  }

  return result;
}

function stripJsonTrailingCommas(source) {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];

    if (inString) {
      result += current;
      if (escapeNext) {
        escapeNext = false;
      } else if (current === '\\') {
        escapeNext = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === ',') {
      let lookahead = index + 1;
      while (lookahead < source.length && /\s/.test(source[lookahead])) {
        lookahead += 1;
      }
      if (source[lookahead] === '}' || source[lookahead] === ']') {
        continue;
      }
    }

    result += current;
  }

  return result;
}

function parseJsonObjectLikeFile(source, relativePath) {
  let parsed;
  try {
    parsed = JSON.parse(stripJsonTrailingCommas(stripJsonComments(source)));
  } catch (error) {
    throw new Error(`Unable to parse ${relativePath} as JSON or JSONC: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${relativePath} must contain a top-level object.`);
  }

  return parsed;
}

function uniqueStringList(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (typeof value !== 'string' || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

function buildRepoVscodeSettings(existingSettings = {}) {
  const nextSettings = { ...existingSettings };
  const existingIgnoredFolders = Array.isArray(existingSettings[REPO_SCAN_IGNORED_FOLDERS_SETTING])
    ? existingSettings[REPO_SCAN_IGNORED_FOLDERS_SETTING]
    : [];

  nextSettings[REPO_SCAN_IGNORED_FOLDERS_SETTING] = uniqueStringList([
    ...existingIgnoredFolders,
    ...MANAGED_REPO_SCAN_IGNORED_FOLDERS,
  ]);

  return nextSettings;
}

function ensureRepoVscodeSettings(repoRoot, dryRun) {
  const settingsPath = path.join(repoRoot, SHARED_VSCODE_SETTINGS_RELATIVE);
  const destinationExists = fs.existsSync(settingsPath);
  const existingContent = destinationExists ? fs.readFileSync(settingsPath, 'utf8') : '';
  const existingSettings = destinationExists
    ? parseJsonObjectLikeFile(existingContent, SHARED_VSCODE_SETTINGS_RELATIVE)
    : {};
  const nextContent = `${JSON.stringify(buildRepoVscodeSettings(existingSettings), null, 2)}\n`;

  if (destinationExists && existingContent === nextContent) {
    return { status: 'unchanged', file: SHARED_VSCODE_SETTINGS_RELATIVE };
  }

  ensureParentDir(repoRoot, settingsPath, dryRun);
  if (!dryRun) {
    fs.writeFileSync(settingsPath, nextContent, 'utf8');
  }

  return {
    status: destinationExists ? 'updated' : 'created',
    file: SHARED_VSCODE_SETTINGS_RELATIVE,
    note: 'shared VS Code repo scan ignores for Guardex worktrees',
  };
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

function appendForceArgs(args, options) {
  if (!options.force) {
    return;
  }
  args.push('--force');
  for (const managedPath of options.forceManagedPaths || []) {
    args.push(managedPath);
  }
}

function shouldForceManagedPath(options, relativePath) {
  if (!options.force) {
    return false;
  }
  const targetedPaths = Array.isArray(options.forceManagedPaths) ? options.forceManagedPaths : [];
  if (targetedPaths.length === 0) {
    return true;
  }
  const normalized = normalizeManagedForcePath(relativePath);
  return normalized !== null && targetedPaths.includes(normalized);
}

function normalizeWorkspacePath(relativePath) {
  return String(relativePath || '.').replace(/\\/g, '/');
}

function buildParentWorkspaceView(repoRoot) {
  const parentDir = path.dirname(repoRoot);
  const workspaceFileName = `${path.basename(repoRoot)}-branches.code-workspace`;
  const workspacePath = path.join(parentDir, workspaceFileName);
  const repoRelativePath = normalizeWorkspacePath(path.relative(parentDir, repoRoot) || '.');

  return {
    workspacePath,
    payload: {
      folders: [
        { path: repoRelativePath },
        ...AGENT_WORKTREE_RELATIVE_DIRS.map((relativeDir) => ({
          path: normalizeWorkspacePath(path.join(repoRelativePath === '.' ? '' : repoRelativePath, relativeDir)),
        })),
      ],
      settings: {
        'scm.alwaysShowRepositories': true,
      },
    },
  };
}

function ensureParentWorkspaceView(repoRoot, dryRun) {
  const { workspacePath, payload } = buildParentWorkspaceView(repoRoot);
  const operationFile = path.relative(repoRoot, workspacePath) || path.basename(workspacePath);
  const nextContent = `${JSON.stringify(payload, null, 2)}\n`;
  const note = 'parent VS Code workspace view';

  if (!fs.existsSync(workspacePath)) {
    if (!dryRun) {
      fs.writeFileSync(workspacePath, nextContent, 'utf8');
    }
    return { status: dryRun ? 'would-create' : 'created', file: operationFile, note };
  }

  const currentContent = fs.readFileSync(workspacePath, 'utf8');
  if (currentContent === nextContent) {
    return { status: 'unchanged', file: operationFile, note };
  }

  if (!dryRun) {
    fs.writeFileSync(workspacePath, nextContent, 'utf8');
  }
  return { status: dryRun ? 'would-update' : 'updated', file: operationFile, note };
}

function hasGuardexBootstrapFiles(repoRoot) {
  const required = [
    'AGENTS.md',
    '.githooks/pre-commit',
    '.githooks/pre-push',
    LOCK_FILE_RELATIVE,
  ];
  return required.every((relativePath) => fs.existsSync(path.join(repoRoot, relativePath)));
}

function protectedBaseWriteBlock(options, { requireBootstrap = true } = {}) {
  if (options.dryRun || options.allowProtectedBaseWrite) {
    return null;
  }

  const repoRoot = resolveRepoRoot(options.target);
  if (requireBootstrap && !hasGuardexBootstrapFiles(repoRoot)) {
    return null;
  }

  const branch = currentBranchName(repoRoot);
  if (branch !== 'main') {
    return null;
  }

  const protectedBranches = readProtectedBranches(repoRoot);
  if (!protectedBranches.includes(branch)) {
    return null;
  }

  return {
    repoRoot,
    branch,
  };
}

function assertProtectedMainWriteAllowed(options, commandName) {
  return getSandboxApi().assertProtectedMainWriteAllowed(options, commandName);
}

function runSetupBootstrapInternal(options) {
  return getSandboxApi().runSetupBootstrapInternal(options);
}

function extractAgentBranchStartMetadata(output) {
  const branchMatch = String(output || '').match(/^\[agent-branch-start\] Created branch: (.+)$/m);
  const worktreeMatch = String(output || '').match(/^\[agent-branch-start\] Worktree: (.+)$/m);
  return {
    branch: branchMatch ? branchMatch[1].trim() : '',
    worktreePath: worktreeMatch ? worktreeMatch[1].trim() : '',
  };
}

function resolveSandboxTarget(repoRoot, worktreePath, targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  const relativeTarget = path.relative(repoRoot, resolvedTarget);
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error(`sandbox target must stay inside repo root: ${resolvedTarget}`);
  }
  if (!relativeTarget || relativeTarget === '.') {
    return worktreePath;
  }
  return path.join(worktreePath, relativeTarget);
}

function buildSandboxSetupArgs(options, sandboxTarget) {
  const args = ['setup', '--target', sandboxTarget, '--no-global-install', '--no-recursive'];
  appendForceArgs(args, options);
  if (options.skipAgents) args.push('--skip-agents');
  if (options.skipPackageJson) args.push('--skip-package-json');
  if (options.skipGitignore) args.push('--no-gitignore');
  if (options.dryRun) args.push('--dry-run');
  return args;
}

function buildSandboxDoctorArgs(options, sandboxTarget) {
  const args = ['doctor', '--target', sandboxTarget];
  if (options.dryRun) args.push('--dry-run');
  appendForceArgs(args, options);
  if (options.skipAgents) args.push('--skip-agents');
  if (options.skipPackageJson) args.push('--skip-package-json');
  if (options.skipGitignore) args.push('--no-gitignore');
  if (!options.dropStaleLocks) args.push('--keep-stale-locks');
  args.push(options.waitForMerge ? '--wait-for-merge' : '--no-wait-for-merge');
  if (options.verboseAutoFinish) args.push('--verbose-auto-finish');
  if (options.json) args.push('--json');
  return args;
}

function isSpawnFailure(result) {
  return Boolean(result?.error) && typeof result?.status !== 'number';
}

function ensureRepoBranch(repoRoot, branch) {
  const current = currentBranchName(repoRoot);
  if (current === branch) {
    return { ok: true, changed: false };
  }

  const checkoutResult = run('git', ['-C', repoRoot, 'checkout', branch], { timeout: 20_000 });
  if (isSpawnFailure(checkoutResult)) {
    return {
      ok: false,
      changed: false,
      stdout: checkoutResult.stdout || '',
      stderr: checkoutResult.stderr || '',
    };
  }
  if (checkoutResult.status !== 0) {
    return {
      ok: false,
      changed: false,
      stdout: checkoutResult.stdout || '',
      stderr: checkoutResult.stderr || '',
    };
  }

  return { ok: true, changed: true };
}

function protectedBaseSandboxBranchPrefix() {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('') + '-' + [
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  return `agent/gx/${stamp}`;
}

function protectedBaseSandboxWorktreePath(repoRoot, branchName) {
  return path.join(repoRoot, defaultAgentWorktreeRelativeDir(), branchName.replace(/\//g, '__'));
}

function resolveProtectedBaseSandboxStartRef(repoRoot, baseBranch) {
  run('git', ['-C', repoRoot, 'fetch', 'origin', baseBranch, '--quiet'], { timeout: 20_000 });
  if (gitRefExists(repoRoot, `refs/remotes/origin/${baseBranch}`)) {
    return `origin/${baseBranch}`;
  }
  if (gitRefExists(repoRoot, `refs/heads/${baseBranch}`)) {
    return baseBranch;
  }
  if (currentBranchName(repoRoot) === baseBranch) {
    return null;
  }
  throw new Error(`Unable to find base ref for sandbox bootstrap: ${baseBranch}`);
}

function startProtectedBaseSandboxFallback(blocked, sandboxSuffix) {
  const branchPrefix = protectedBaseSandboxBranchPrefix();
  let selectedBranch = '';
  let selectedWorktreePath = '';

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = attempt === 0 ? sandboxSuffix : `${attempt + 1}-${sandboxSuffix}`;
    const candidateBranch = `${branchPrefix}-${suffix}`;
    const candidateWorktreePath = protectedBaseSandboxWorktreePath(blocked.repoRoot, candidateBranch);
    if (gitRefExists(blocked.repoRoot, `refs/heads/${candidateBranch}`)) {
      continue;
    }
    if (fs.existsSync(candidateWorktreePath)) {
      continue;
    }
    selectedBranch = candidateBranch;
    selectedWorktreePath = candidateWorktreePath;
    break;
  }

  if (!selectedBranch || !selectedWorktreePath) {
    throw new Error('Unable to allocate unique sandbox branch/worktree');
  }

  fs.mkdirSync(path.dirname(selectedWorktreePath), { recursive: true });
  const startRef = resolveProtectedBaseSandboxStartRef(blocked.repoRoot, blocked.branch);
  const addArgs = startRef
    ? ['-C', blocked.repoRoot, 'worktree', 'add', '-b', selectedBranch, selectedWorktreePath, startRef]
    : ['-C', blocked.repoRoot, 'worktree', 'add', '--orphan', selectedWorktreePath];
  const addResult = run('git', addArgs);
  if (isSpawnFailure(addResult)) {
    throw addResult.error;
  }
  if (addResult.status !== 0) {
    throw new Error((addResult.stderr || addResult.stdout || 'failed to create sandbox').trim());
  }

  if (!startRef) {
    const renameResult = run(
      'git',
      ['-C', selectedWorktreePath, 'branch', '-m', selectedBranch],
      { timeout: 20_000 },
    );
    if (isSpawnFailure(renameResult)) {
      throw renameResult.error;
    }
    if (renameResult.status !== 0) {
      throw new Error(
        (renameResult.stderr || renameResult.stdout || 'failed to name orphan sandbox branch').trim(),
      );
    }
  }

  return {
    metadata: {
      branch: selectedBranch,
      worktreePath: selectedWorktreePath,
    },
    stdout:
      `[agent-branch-start] Created branch: ${selectedBranch}\n` +
      `[agent-branch-start] Worktree: ${selectedWorktreePath}\n`,
    stderr: addResult.stderr || '',
  };
}

function startProtectedBaseSandbox(blocked, { taskName, sandboxSuffix }) {
  if (sandboxSuffix === 'gx-doctor') {
    return startProtectedBaseSandboxFallback(blocked, sandboxSuffix);
  }

  const startResult = runPackageAsset('branchStart', [
    '--task',
    taskName,
    '--agent',
    SHORT_TOOL_NAME,
    '--base',
    blocked.branch,
  ], { cwd: blocked.repoRoot });
  if (isSpawnFailure(startResult)) {
    throw startResult.error;
  }
  if (startResult.status !== 0) {
    return startProtectedBaseSandboxFallback(blocked, sandboxSuffix);
  }

  const metadata = extractAgentBranchStartMetadata(startResult.stdout);
  const currentBranch = currentBranchName(blocked.repoRoot);
  const worktreePath = metadata.worktreePath ? path.resolve(metadata.worktreePath) : '';
  const repoRootPath = path.resolve(blocked.repoRoot);
  const hasSafeWorktree = Boolean(worktreePath) && worktreePath !== repoRootPath;
  const branchChanged = Boolean(currentBranch) && currentBranch !== blocked.branch;

  if (!hasSafeWorktree || branchChanged) {
    const restoreResult = ensureRepoBranch(blocked.repoRoot, blocked.branch);
    if (!restoreResult.ok) {
      const detail = [restoreResult.stderr, restoreResult.stdout].filter(Boolean).join('\n').trim();
      throw new Error(
        `sandbox startup switched protected base checkout and could not restore '${blocked.branch}'.` +
        (detail ? `\n${detail}` : ''),
      );
    }
    return startProtectedBaseSandboxFallback(blocked, sandboxSuffix);
  }

  return {
    metadata,
    stdout: startResult.stdout || '',
    stderr: startResult.stderr || '',
  };
}

function cleanupProtectedBaseSandbox(repoRoot, metadata) {
  const result = {
    worktree: 'skipped',
    branch: 'skipped',
    note: 'missing sandbox metadata',
  };

  if (!metadata?.worktreePath || !metadata?.branch) {
    return result;
  }

  if (fs.existsSync(metadata.worktreePath)) {
    const removeResult = run(
      'git',
      ['-C', repoRoot, 'worktree', 'remove', '--force', metadata.worktreePath],
      { timeout: 30_000 },
    );
    if (isSpawnFailure(removeResult)) {
      throw removeResult.error;
    }
    if (removeResult.status !== 0) {
      throw new Error(
        (removeResult.stderr || removeResult.stdout || 'failed to remove sandbox worktree').trim(),
      );
    }
    result.worktree = 'removed';
  } else {
    result.worktree = 'missing';
  }

  if (gitRefExists(repoRoot, `refs/heads/${metadata.branch}`)) {
    const branchDeleteResult = run(
      'git',
      ['-C', repoRoot, 'branch', '-D', metadata.branch],
      { timeout: 20_000 },
    );
    if (isSpawnFailure(branchDeleteResult)) {
      throw branchDeleteResult.error;
    }
    if (branchDeleteResult.status !== 0) {
      throw new Error(
        (branchDeleteResult.stderr || branchDeleteResult.stdout || 'failed to delete sandbox branch').trim(),
      );
    }
    result.branch = 'deleted';
  } else {
    result.branch = 'missing';
  }

  result.note = 'sandbox worktree pruned';
  return result;
}

function parseGitPathList(output) {
  return String(output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== LOCK_FILE_RELATIVE);
}

function collectDoctorChangedPaths(worktreePath) {
  const changed = new Set();
  const commands = [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  for (const gitArgs of commands) {
    const result = run('git', ['-C', worktreePath, ...gitArgs], { timeout: 20_000 });
    for (const filePath of parseGitPathList(result.stdout)) {
      changed.add(filePath);
    }
  }
  return Array.from(changed);
}

function collectDoctorDeletedPaths(worktreePath) {
  const deleted = new Set();
  const commands = [
    ['diff', '--name-only', '--diff-filter=D'],
    ['diff', '--cached', '--name-only', '--diff-filter=D'],
  ];
  for (const gitArgs of commands) {
    const result = run('git', ['-C', worktreePath, ...gitArgs], { timeout: 20_000 });
    for (const filePath of parseGitPathList(result.stdout)) {
      deleted.add(filePath);
    }
  }
  return Array.from(deleted);
}

function collectWorktreeDirtyPaths(worktreePath) {
  const dirty = new Set();
  const commands = [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  for (const gitArgs of commands) {
    const result = run('git', ['-C', worktreePath, ...gitArgs], { timeout: 20_000 });
    for (const filePath of parseGitPathList(result.stdout)) {
      dirty.add(filePath);
    }
  }
  return Array.from(dirty);
}

function collectDoctorForceAddPaths(worktreePath) {
  return REQUIRED_MANAGED_REPO_FILES
    .filter((relativePath) => relativePath.startsWith('scripts/') || relativePath.startsWith('.githooks/'))
    .filter((relativePath) => fs.existsSync(path.join(worktreePath, relativePath)));
}

function stripDoctorSandboxLocks(rawContent, branchName) {
  if (!rawContent || !branchName) {
    return rawContent;
  }
  try {
    const parsed = JSON.parse(rawContent);
    const locks = parsed && typeof parsed === 'object' && parsed.locks && typeof parsed.locks === 'object'
      ? parsed.locks
      : null;
    if (!locks) {
      return rawContent;
    }
    let changed = false;
    const filteredLocks = {};
    for (const [filePath, lockInfo] of Object.entries(locks)) {
      if (lockInfo && lockInfo.branch === branchName) {
        changed = true;
        continue;
      }
      filteredLocks[filePath] = lockInfo;
    }
    if (!changed) {
      return rawContent;
    }
    return `${JSON.stringify({ ...parsed, locks: filteredLocks }, null, 2)}\n`;
  } catch {
    return rawContent;
  }
}

function claimDoctorChangedLocks(metadata) {
  if (!metadata.branch) {
    return {
      status: 'skipped',
      note: 'missing sandbox branch metadata',
      changedCount: 0,
      deletedCount: 0,
    };
  }

  const changedPaths = Array.from(new Set([
    ...collectDoctorChangedPaths(metadata.worktreePath),
    ...collectDoctorForceAddPaths(metadata.worktreePath),
  ]));
  const deletedPaths = collectDoctorDeletedPaths(metadata.worktreePath);
  if (changedPaths.length > 0) {
    runPackageAsset('lockTool', ['claim', '--branch', metadata.branch, ...changedPaths], {
      cwd: metadata.worktreePath,
      timeout: 30_000,
    });
  }
  if (deletedPaths.length > 0) {
    runPackageAsset('lockTool', ['allow-delete', '--branch', metadata.branch, ...deletedPaths], {
      cwd: metadata.worktreePath,
      timeout: 30_000,
    });
  }

  return {
    status: 'claimed',
    note: 'claimed locks for doctor auto-commit',
    changedCount: changedPaths.length,
    deletedCount: deletedPaths.length,
  };
}

function autoCommitDoctorSandboxChanges(metadata) {
  if (!metadata.worktreePath || !metadata.branch) {
    return {
      status: 'skipped',
      note: 'missing sandbox branch metadata',
    };
  }

  claimDoctorChangedLocks(metadata);
  run(
    'git',
    ['-C', metadata.worktreePath, 'add', '-A', '--', '.', `:(exclude)${LOCK_FILE_RELATIVE}`],
    { timeout: 20_000 },
  );
  const forceAddPaths = collectDoctorForceAddPaths(metadata.worktreePath);
  if (forceAddPaths.length > 0) {
    run(
      'git',
      ['-C', metadata.worktreePath, 'add', '-f', '--', ...forceAddPaths],
      { timeout: 20_000 },
    );
  }
  const staged = run(
    'git',
    ['-C', metadata.worktreePath, 'diff', '--cached', '--name-only', '--', '.', `:(exclude)${LOCK_FILE_RELATIVE}`],
    { timeout: 20_000 },
  );
  const stagedFiles = parseGitPathList(staged.stdout);
  if (stagedFiles.length === 0) {
    return {
      status: 'no-changes',
      note: 'no committable doctor changes found in sandbox',
    };
  }

  const commitResult = run(
    'git',
    ['-C', metadata.worktreePath, 'commit', '-m', 'Auto-finish: gx doctor repairs'],
    { timeout: 30_000 },
  );
  if (commitResult.status !== 0) {
    return {
      status: 'failed',
      note: 'doctor sandbox auto-commit failed',
      stdout: commitResult.stdout || '',
      stderr: commitResult.stderr || '',
    };
  }

  return {
    status: 'committed',
    note: 'doctor sandbox repairs committed',
    commitMessage: 'Auto-finish: gx doctor repairs',
    stagedFiles,
  };
}

function hasOriginRemote(repoRoot) {
  return run('git', ['-C', repoRoot, 'remote', 'get-url', 'origin']).status === 0;
}

function originRemoteLooksLikeGithub(repoRoot) {
  const originUrl = readGitConfig(repoRoot, 'remote.origin.url');
  if (!originUrl) {
    return false;
  }
  return /github\.com[:/]/i.test(originUrl);
}

function isCommandAvailable(commandName) {
  return run('which', [commandName]).status === 0;
}

function extractAgentBranchFinishPrUrl(output) {
  const match = String(output || '').match(/\[agent-branch-finish\] PR:\s*(\S+)/);
  return match ? match[1] : '';
}

function doctorFinishFlowIsPending(output) {
  return (
    /\[agent-branch-finish\] PR merge not completed yet; leaving PR open\./.test(output) ||
    /\[agent-branch-finish\] Merge pending review\/check policy\. Branch cleanup skipped for now\./.test(output) ||
    /\[agent-branch-finish\] PR auto-merge enabled; waiting for required checks\/reviews\./.test(output)
  );
}

function finishDoctorSandboxBranch(blocked, metadata, options = {}) {
  if (!hasOriginRemote(blocked.repoRoot)) {
    return {
      status: 'skipped',
      note: 'origin remote missing; skipped auto-finish',
    };
  }
  const explicitGhBin = Boolean(String(process.env.GUARDEX_GH_BIN || '').trim());
  if (!explicitGhBin && !originRemoteLooksLikeGithub(blocked.repoRoot)) {
    return {
      status: 'skipped',
      note: 'origin remote is not GitHub; skipped auto-finish PR flow',
    };
  }

  const ghBin = process.env.GUARDEX_GH_BIN || 'gh';
  if (!isCommandAvailable(ghBin)) {
    return {
      status: 'skipped',
      note: `'${ghBin}' not available; skipped auto-finish PR flow`,
    };
  }
  const ghAuthStatus = run(ghBin, ['auth', 'status'], { timeout: 20_000 });
  if (ghAuthStatus.status !== 0) {
    return {
      status: 'skipped',
      note: `'${ghBin}' auth unavailable; skipped auto-finish PR flow`,
      stderr: ghAuthStatus.stderr || '',
    };
  }

  const rawWaitTimeoutSeconds = Number.parseInt(process.env.GUARDEX_FINISH_WAIT_TIMEOUT_SECONDS || '1800', 10);
  const waitTimeoutSeconds =
    Number.isFinite(rawWaitTimeoutSeconds) && rawWaitTimeoutSeconds >= 30 ? rawWaitTimeoutSeconds : 1800;
  const finishTimeoutMs = Math.max(180_000, (waitTimeoutSeconds + 60) * 1000);
  const waitForMergeArg = options.waitForMerge === false ? '--no-wait-for-merge' : '--wait-for-merge';

  const finishResult = runPackageAsset(
    'branchFinish',
    ['--branch', metadata.branch, '--base', blocked.branch, '--via-pr', waitForMergeArg, '--cleanup'],
    { cwd: metadata.worktreePath, timeout: finishTimeoutMs },
  );
  if (isSpawnFailure(finishResult)) {
    return {
      status: 'failed',
      note: 'doctor sandbox finish flow errored',
      stdout: finishResult.stdout || '',
      stderr: finishResult.stderr || '',
    };
  }
  if (finishResult.status !== 0) {
    return {
      status: 'failed',
      note: 'doctor sandbox finish flow failed',
      stdout: finishResult.stdout || '',
      stderr: finishResult.stderr || '',
    };
  }

  const combinedOutput = `${finishResult.stdout || ''}\n${finishResult.stderr || ''}`;
  if (doctorFinishFlowIsPending(combinedOutput)) {
    return {
      status: 'pending',
      note: 'PR created and waiting for merge policy/checks',
      prUrl: extractAgentBranchFinishPrUrl(combinedOutput),
      stdout: finishResult.stdout || '',
      stderr: finishResult.stderr || '',
    };
  }

  return {
    status: 'completed',
    note: 'doctor sandbox finish flow completed',
    stdout: finishResult.stdout || '',
    stderr: finishResult.stderr || '',
  };
}

function mergeDoctorSandboxRepairsBackToProtectedBase(options, blocked, metadata, autoCommitResult, finishResult) {
  if (options.dryRun) {
    return {
      status: autoCommitResult.status === 'committed' ? 'would-merge' : 'skipped',
      note: autoCommitResult.status === 'committed'
        ? 'dry run: would fast-forward tracked doctor repairs into the protected base workspace'
        : 'dry run skips tracked repair merge',
    };
  }

  if (autoCommitResult.status !== 'committed') {
    return {
      status: autoCommitResult.status === 'no-changes' ? 'unchanged' : 'skipped',
      note: autoCommitResult.status === 'no-changes'
        ? 'no tracked doctor repairs needed in the protected base workspace'
        : 'tracked doctor repair merge skipped',
    };
  }

  if (finishResult.status !== 'skipped') {
    return {
      status: 'skipped',
      note: finishResult.status === 'failed'
        ? 'tracked doctor repairs remain in the sandbox after finish failure'
        : 'tracked doctor repairs are being delivered through the sandbox finish flow',
    };
  }

  const allowedPaths = new Set([
    ...(autoCommitResult.stagedFiles || []),
    ...OMX_SCAFFOLD_DIRECTORIES,
    ...Array.from(OMX_SCAFFOLD_FILES.keys()),
    ...REQUIRED_MANAGED_REPO_FILES,
    'bin',
    'package.json',
    '.gitignore',
    'AGENTS.md',
  ]);
  const dirtyPaths = collectWorktreeDirtyPaths(blocked.repoRoot);
  let stashRef = '';
  if (dirtyPaths.length > 0) {
    const unexpectedPaths = dirtyPaths.filter((filePath) => {
      if (allowedPaths.has(filePath)) {
        return false;
      }
      return !AGENT_WORKTREE_RELATIVE_DIRS.some(
        (relativeDir) => filePath === relativeDir || filePath.startsWith(`${relativeDir}/`),
      );
    });
    if (unexpectedPaths.length > 0) {
      return {
        status: 'failed',
        note: `protected branch workspace has unrelated local changes: ${unexpectedPaths.join(', ')}`,
      };
    }
    const stashMessage = `guardex-doctor-merge-${Date.now()}`;
    const stashResult = run(
      'git',
      ['-C', blocked.repoRoot, 'stash', 'push', '--all', '--message', stashMessage],
      { timeout: 30_000 },
    );
    if (isSpawnFailure(stashResult)) {
      return {
        status: 'failed',
        note: 'could not stash protected branch doctor drift before merge',
        stdout: stashResult.stdout || '',
        stderr: stashResult.stderr || '',
      };
    }
    if (stashResult.status !== 0) {
      return {
        status: 'failed',
        note: 'stashing protected branch doctor drift failed',
        stdout: stashResult.stdout || '',
        stderr: stashResult.stderr || '',
      };
    }

    const stashLookup = run(
      'git',
      ['-C', blocked.repoRoot, 'stash', 'list'],
      { timeout: 20_000 },
    );
    stashRef = String(stashLookup.stdout || '')
      .split('\n')
      .find((line) => line.includes(stashMessage))
      ?.split(':')[0]
      ?.trim() || '';
  }

  const restoreResult = ensureRepoBranch(blocked.repoRoot, blocked.branch);
  if (!restoreResult.ok) {
    if (stashRef) {
      run('git', ['-C', blocked.repoRoot, 'stash', 'apply', stashRef], { timeout: 30_000 });
    }
    return {
      status: 'failed',
      note: `could not restore protected branch '${blocked.branch}' before applying sandbox repairs`,
      stdout: restoreResult.stdout || '',
      stderr: restoreResult.stderr || '',
    };
  }

  const mergeResult = run(
    'git',
    ['-C', blocked.repoRoot, 'merge', '--ff-only', metadata.branch],
    { timeout: 30_000 },
  );
  if (isSpawnFailure(mergeResult)) {
    if (stashRef) {
      run('git', ['-C', blocked.repoRoot, 'stash', 'apply', stashRef], { timeout: 30_000 });
    }
    return {
      status: 'failed',
      note: 'tracked doctor repair merge errored',
      stdout: mergeResult.stdout || '',
      stderr: mergeResult.stderr || '',
    };
  }
  if (mergeResult.status !== 0) {
    if (stashRef) {
      run('git', ['-C', blocked.repoRoot, 'stash', 'apply', stashRef], { timeout: 30_000 });
    }
    return {
      status: 'failed',
      note: 'tracked doctor repair merge failed',
      stdout: mergeResult.stdout || '',
      stderr: mergeResult.stderr || '',
    };
  }

  let cleanupResult;
  try {
    cleanupResult = cleanupProtectedBaseSandbox(blocked.repoRoot, metadata);
  } catch (error) {
    return {
      status: 'failed',
      note: `tracked doctor repair merge succeeded but sandbox cleanup failed: ${error.message}`,
      stdout: mergeResult.stdout || '',
      stderr: mergeResult.stderr || '',
    };
  }

  let hookRefreshResult;
  try {
    hookRefreshResult = configureHooks(blocked.repoRoot, false);
  } catch (error) {
    return {
      status: 'failed',
      note: `tracked doctor repair merge succeeded but local hook refresh failed: ${error.message}`,
      stdout: mergeResult.stdout || '',
      stderr: mergeResult.stderr || '',
    };
  }

  if (stashRef) {
    run('git', ['-C', blocked.repoRoot, 'stash', 'drop', stashRef], { timeout: 20_000 });
  }

  return {
    status: 'merged',
    note: 'fast-forwarded tracked doctor repairs into the protected base workspace',
    stdout: mergeResult.stdout || '',
    stderr: mergeResult.stderr || '',
    cleanup: cleanupResult,
    hookRefresh: hookRefreshResult,
  };
}

/**
 * @param {string} [note]
 * @returns {OperationResult}
 */
function createDoctorSkippedOperation(note = 'sandbox doctor did not complete successfully') {
  return {
    status: 'skipped',
    note,
  };
}

/**
 * @param {string} [note]
 * @returns {AutoFinishSummary}
 */
function createSkippedDoctorAutoFinishSummary(note = 'sandbox doctor did not complete successfully') {
  return {
    enabled: false,
    attempted: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    details: [`Skipped auto-finish sweep (${note}).`],
  };
}

/**
 * Default the lifecycle to skipped states until the nested doctor run succeeds.
 *
 * @param {string} [note]
 * @returns {DoctorSandboxExecution}
 */
function createDoctorSandboxExecutionState(note = 'sandbox doctor did not complete successfully') {
  return {
    autoCommit: createDoctorSkippedOperation(note),
    finish: createDoctorSkippedOperation(note),
    protectedBaseRepairSync: createDoctorSkippedOperation(note),
    lockSync: createDoctorSkippedOperation(note),
    omxScaffoldSync: createDoctorSkippedOperation(note),
    autoFinish: createSkippedDoctorAutoFinishSummary(note),
    sandboxLockContent: null,
  };
}

/**
 * @param {string} repoRoot
 * @param {boolean} dryRun
 * @returns {OperationResult}
 */
function summarizeDoctorOmxScaffoldSync(repoRoot, dryRun) {
  const omxScaffoldOps = ensureOmxScaffold(repoRoot, dryRun);
  const changedOmxPaths = omxScaffoldOps.filter((operation) => operation.status !== 'unchanged');
  if (changedOmxPaths.length === 0) {
    return {
      status: 'unchanged',
      note: '.omx scaffold already in sync',
      operations: omxScaffoldOps,
    };
  }
  return {
    status: dryRun ? 'would-sync' : 'synced',
    note: `${dryRun ? 'would sync' : 'synced'} ${changedOmxPaths.length} .omx path(s)`,
    operations: omxScaffoldOps,
  };
}

/**
 * @param {string} repoRoot
 * @param {SandboxMetadata} metadata
 * @returns {DoctorLockSyncState}
 */
function syncDoctorLockRegistryBeforeMerge(repoRoot, metadata) {
  const sandboxLockPath = path.join(metadata.worktreePath, LOCK_FILE_RELATIVE);
  const baseLockPath = path.join(repoRoot, LOCK_FILE_RELATIVE);
  if (!fs.existsSync(baseLockPath)) {
    return {
      result: {
        status: 'skipped',
        note: `${LOCK_FILE_RELATIVE} missing in protected base workspace`,
      },
      sandboxLockContent: null,
    };
  }
  if (!fs.existsSync(sandboxLockPath)) {
    return {
      result: {
        status: 'skipped',
        note: `${LOCK_FILE_RELATIVE} missing in sandbox worktree`,
      },
      sandboxLockContent: null,
    };
  }

  const sourceContent = stripDoctorSandboxLocks(
    fs.readFileSync(sandboxLockPath, 'utf8'),
    metadata.branch,
  );
  const destinationContent = fs.readFileSync(baseLockPath, 'utf8');
  if (sourceContent === destinationContent) {
    return {
      result: {
        status: 'unchanged',
        note: `${LOCK_FILE_RELATIVE} already in sync`,
      },
      sandboxLockContent: sourceContent,
    };
  }

  fs.mkdirSync(path.dirname(baseLockPath), { recursive: true });
  fs.writeFileSync(baseLockPath, sourceContent, 'utf8');
  return {
    result: {
      status: 'synced',
      note: `${LOCK_FILE_RELATIVE} synced from sandbox`,
    },
    sandboxLockContent: sourceContent,
  };
}

/**
 * @param {string} repoRoot
 * @param {string | null} sandboxLockContent
 * @returns {OperationResult}
 */
function syncDoctorLockRegistryAfterMerge(repoRoot, sandboxLockContent) {
  if (sandboxLockContent === null) {
    return {
      status: 'skipped',
      note: `${LOCK_FILE_RELATIVE} missing in sandbox worktree`,
    };
  }

  const baseLockPath = path.join(repoRoot, LOCK_FILE_RELATIVE);
  if (!fs.existsSync(baseLockPath)) {
    fs.mkdirSync(path.dirname(baseLockPath), { recursive: true });
    fs.writeFileSync(baseLockPath, sandboxLockContent, 'utf8');
    return {
      status: 'synced',
      note: `${LOCK_FILE_RELATIVE} recreated from sandbox`,
    };
  }

  const destinationContent = fs.readFileSync(baseLockPath, 'utf8');
  if (sandboxLockContent === destinationContent) {
    return {
      status: 'unchanged',
      note: `${LOCK_FILE_RELATIVE} already in sync`,
    };
  }

  fs.mkdirSync(path.dirname(baseLockPath), { recursive: true });
  fs.writeFileSync(baseLockPath, sandboxLockContent, 'utf8');
  return {
    status: 'synced',
    note: `${LOCK_FILE_RELATIVE} synced from sandbox`,
  };
}

/**
 * @param {object} options
 * @param {{ repoRoot: string, branch: string }} blocked
 * @param {SandboxMetadata} metadata
 * @returns {DoctorSandboxExecution}
 */
function executeDoctorSandboxLifecycle(options, blocked, metadata) {
  const execution = createDoctorSandboxExecutionState();
  const dryRun = Boolean(options.dryRun);

  execution.omxScaffoldSync = summarizeDoctorOmxScaffoldSync(blocked.repoRoot, dryRun);

  if (!dryRun) {
    execution.autoCommit = autoCommitDoctorSandboxChanges(metadata);
    if (execution.autoCommit.status === 'committed') {
      execution.finish = finishDoctorSandboxBranch(blocked, metadata, options);
    } else if (execution.autoCommit.status === 'no-changes') {
      execution.finish = createDoctorSkippedOperation('no doctor changes to auto-finish');
    } else if (execution.autoCommit.status !== 'failed') {
      execution.finish = createDoctorSkippedOperation('auto-commit did not run');
    }
  } else {
    execution.autoCommit = createDoctorSkippedOperation('dry-run skips doctor sandbox auto-commit');
    execution.finish = createDoctorSkippedOperation('dry-run skips doctor sandbox finish flow');
  }

  const lockSyncState = syncDoctorLockRegistryBeforeMerge(blocked.repoRoot, metadata);
  execution.lockSync = lockSyncState.result;
  execution.sandboxLockContent = lockSyncState.sandboxLockContent;

  execution.protectedBaseRepairSync = mergeDoctorSandboxRepairsBackToProtectedBase(
    options,
    blocked,
    metadata,
    execution.autoCommit,
    execution.finish,
  );

  execution.omxScaffoldSync = summarizeDoctorOmxScaffoldSync(blocked.repoRoot, dryRun);
  execution.lockSync = syncDoctorLockRegistryAfterMerge(
    blocked.repoRoot,
    execution.sandboxLockContent,
  );
  execution.autoFinish = autoFinishReadyAgentBranches(blocked.repoRoot, {
    baseBranch: blocked.branch,
    dryRun: options.dryRun,
    waitForMerge: options.waitForMerge,
    excludeBranches: [metadata.branch],
  });

  return execution;
}

function emitDoctorSandboxJsonOutput(nestedResult, execution) {
  if (nestedResult.stdout) {
    if (nestedResult.status === 0) {
      try {
        const parsed = JSON.parse(nestedResult.stdout);
        process.stdout.write(
          JSON.stringify(
            {
              ...parsed,
              protectedBaseRepairSync: execution.protectedBaseRepairSync,
              sandboxOmxScaffoldSync: execution.omxScaffoldSync,
              sandboxLockSync: execution.lockSync,
              sandboxAutoCommit: execution.autoCommit,
              sandboxFinish: execution.finish,
              autoFinish: execution.autoFinish,
            },
            null,
            2,
          ) + '\n',
        );
      } catch {
        process.stdout.write(nestedResult.stdout);
      }
    } else {
      process.stdout.write(nestedResult.stdout);
    }
  }
  if (nestedResult.stderr) process.stderr.write(nestedResult.stderr);
}

/**
 * @param {object} options
 * @param {{ branch: string }} blocked
 * @param {SandboxMetadata} metadata
 * @param {SandboxStartResult} startResult
 * @param {any} nestedResult
 * @param {DoctorSandboxExecution} execution
 */
function emitDoctorSandboxConsoleOutput(options, blocked, metadata, startResult, nestedResult, execution) {
  console.log(
    `[${TOOL_NAME}] doctor detected protected branch '${blocked.branch}'. ` +
    `Running repairs in sandbox branch '${metadata.branch || 'agent/<auto>'}'.`,
  );
  if (startResult.stdout) process.stdout.write(startResult.stdout);
  if (startResult.stderr) process.stderr.write(startResult.stderr);
  if (nestedResult.stdout) process.stdout.write(nestedResult.stdout);
  if (nestedResult.stderr) process.stderr.write(nestedResult.stderr);
  if (nestedResult.status !== 0) {
    return;
  }

  if (execution.autoCommit.status === 'committed') {
    console.log(
      `[${TOOL_NAME}] Auto-committed doctor repairs in sandbox branch '${metadata.branch}'.`,
    );
  } else if (execution.autoCommit.status === 'failed') {
    console.log(`[${TOOL_NAME}] Doctor sandbox auto-commit failed; branch left for manual follow-up.`);
    if (execution.autoCommit.stdout) process.stdout.write(execution.autoCommit.stdout);
    if (execution.autoCommit.stderr) process.stderr.write(execution.autoCommit.stderr);
  } else {
    console.log(`[${TOOL_NAME}] Doctor sandbox auto-commit skipped: ${execution.autoCommit.note}.`);
  }

  if (execution.protectedBaseRepairSync.status === 'merged') {
    console.log(`[${TOOL_NAME}] Fast-forwarded tracked doctor repairs into the protected branch workspace.`);
  } else if (execution.protectedBaseRepairSync.status === 'unchanged') {
    console.log(`[${TOOL_NAME}] Protected branch workspace already had the tracked doctor repairs.`);
  } else if (execution.protectedBaseRepairSync.status === 'would-merge') {
    console.log(`[${TOOL_NAME}] Dry run: would fast-forward tracked doctor repairs into the protected branch workspace.`);
  } else if (execution.protectedBaseRepairSync.status === 'failed') {
    console.log(`[${TOOL_NAME}] Protected branch tracked repair merge failed: ${execution.protectedBaseRepairSync.note}.`);
    if (execution.protectedBaseRepairSync.stdout) process.stdout.write(execution.protectedBaseRepairSync.stdout);
    if (execution.protectedBaseRepairSync.stderr) process.stderr.write(execution.protectedBaseRepairSync.stderr);
  } else {
    console.log(`[${TOOL_NAME}] Protected branch tracked repair merge skipped: ${execution.protectedBaseRepairSync.note}.`);
  }

  if (execution.lockSync.status === 'synced') {
    console.log(
      `[${TOOL_NAME}] Synced repaired lock registry back to protected branch workspace (${LOCK_FILE_RELATIVE}).`,
    );
  } else if (execution.lockSync.status === 'unchanged') {
    console.log(`[${TOOL_NAME}] Lock registry already synced in protected branch workspace.`);
  } else {
    console.log(`[${TOOL_NAME}] Lock registry sync skipped: ${execution.lockSync.note}.`);
  }

  if (execution.finish.status === 'completed') {
    console.log(`[${TOOL_NAME}] Auto-finish flow completed for sandbox branch '${metadata.branch}'.`);
    if (execution.finish.stdout) process.stdout.write(execution.finish.stdout);
    if (execution.finish.stderr) process.stderr.write(execution.finish.stderr);
  } else if (execution.finish.status === 'pending') {
    console.log(
      `[${TOOL_NAME}] Auto-finish pending for sandbox branch '${metadata.branch}': ${execution.finish.note}.`,
    );
    if (execution.finish.prUrl) {
      console.log(`[${TOOL_NAME}] PR: ${execution.finish.prUrl}`);
    }
    if (execution.finish.stdout) process.stdout.write(execution.finish.stdout);
    if (execution.finish.stderr) process.stderr.write(execution.finish.stderr);
  } else if (execution.finish.status === 'failed') {
    console.log(`[${TOOL_NAME}] Auto-finish flow failed for sandbox branch '${metadata.branch}'.`);
    if (execution.finish.stdout) process.stdout.write(execution.finish.stdout);
    if (execution.finish.stderr) process.stderr.write(execution.finish.stderr);
  } else {
    console.log(`[${TOOL_NAME}] Auto-finish skipped: ${execution.finish.note}.`);
  }

  printAutoFinishSummary(execution.autoFinish, {
    baseBranch: blocked.branch,
    verbose: options.verboseAutoFinish,
  });
  if (execution.omxScaffoldSync.status === 'synced') {
    console.log(`[${TOOL_NAME}] Synced .omx scaffold back to protected branch workspace.`);
  } else if (execution.omxScaffoldSync.status === 'unchanged') {
    console.log(`[${TOOL_NAME}] .omx scaffold already aligned in protected branch workspace.`);
  } else if (execution.omxScaffoldSync.status === 'would-sync') {
    console.log(`[${TOOL_NAME}] Dry run: would sync .omx scaffold back to protected branch workspace.`);
  } else {
    console.log(`[${TOOL_NAME}] .omx scaffold sync skipped: ${execution.omxScaffoldSync.note}.`);
  }
}

function setDoctorSandboxExitCode(nestedResult, execution) {
  if (typeof nestedResult.status === 'number') {
    let exitCode = nestedResult.status;
    if (exitCode === 0 && execution.autoCommit.status === 'failed') {
      exitCode = 1;
    }
    if (
      exitCode === 0 &&
      execution.autoCommit.status === 'committed' &&
      (execution.finish.status === 'failed' || execution.finish.status === 'pending')
    ) {
      exitCode = 1;
    }
    if (exitCode === 0 && execution.protectedBaseRepairSync.status === 'failed') {
      exitCode = 1;
    }
    process.exitCode = exitCode;
    return;
  }
  process.exitCode = 1;
}

function runDoctorInSandbox(options, blocked) {
  /** @type {SandboxStartResult} */
  const startResult = startProtectedBaseSandbox(blocked, {
    taskName: `${SHORT_TOOL_NAME}-doctor`,
    sandboxSuffix: 'gx-doctor',
  });
  const metadata = startResult.metadata;

  const sandboxTarget = resolveSandboxTarget(blocked.repoRoot, metadata.worktreePath, options.target);
  const nestedResult = run(
    process.execPath,
    [__filename, ...buildSandboxDoctorArgs(options, sandboxTarget)],
    { cwd: metadata.worktreePath },
  );
  if (isSpawnFailure(nestedResult)) {
    throw nestedResult.error;
  }

  const execution = nestedResult.status === 0
    ? executeDoctorSandboxLifecycle(options, blocked, metadata)
    : createDoctorSandboxExecutionState();

  if (options.json) {
    emitDoctorSandboxJsonOutput(nestedResult, execution);
  } else {
    emitDoctorSandboxConsoleOutput(options, blocked, metadata, startResult, nestedResult, execution);
  }

  setDoctorSandboxExitCode(nestedResult, execution);
}

function runSetupInSandbox(options, blocked, repoLabel = '') {
  const startResult = startProtectedBaseSandbox(blocked, {
    taskName: `${SHORT_TOOL_NAME}-setup`,
    sandboxSuffix: 'gx-setup',
  });
  const metadata = startResult.metadata;

  if (startResult.stdout) process.stdout.write(startResult.stdout);
  if (startResult.stderr) process.stderr.write(startResult.stderr);
  console.log(
    `[${TOOL_NAME}] setup blocked on protected branch '${blocked.branch}' in an initialized repo; ` +
    'refreshing through a sandbox worktree and syncing managed bootstrap files back locally.',
  );

  const sandboxTarget = resolveSandboxTarget(blocked.repoRoot, metadata.worktreePath, options.target);
  const nestedResult = run(
    process.execPath,
    [__filename, ...buildSandboxSetupArgs(options, sandboxTarget)],
    { cwd: metadata.worktreePath },
  );
  if (isSpawnFailure(nestedResult)) {
    throw nestedResult.error;
  }
  if (nestedResult.status !== 0) {
    if (nestedResult.stdout) process.stdout.write(nestedResult.stdout);
    if (nestedResult.stderr) process.stderr.write(nestedResult.stderr);
    throw new Error(
      `sandboxed setup failed for protected branch '${blocked.branch}'. ` +
      `Inspect sandbox at ${metadata.worktreePath}`,
    );
  }

  const syncOptions = {
    ...options,
    target: blocked.repoRoot,
    recursive: false,
    allowProtectedBaseWrite: true,
  };
  const { installPayload, fixPayload, parentWorkspace } = runSetupBootstrapInternal(syncOptions);
  printOperations(`Setup/install${repoLabel}`, installPayload, syncOptions.dryRun);
  printOperations(`Setup/fix${repoLabel}`, fixPayload, syncOptions.dryRun);
  if (!syncOptions.dryRun && parentWorkspace) {
    console.log(`[${TOOL_NAME}] Parent workspace view: ${parentWorkspace.workspacePath}`);
  }

  const scanResult = runScanInternal({ target: blocked.repoRoot, json: false });
  const currentBaseBranch = currentBranchName(scanResult.repoRoot);
  const autoFinishSummary = autoFinishReadyAgentBranches(scanResult.repoRoot, {
    baseBranch: currentBaseBranch,
    dryRun: syncOptions.dryRun,
  });
  printScanResult(scanResult, false);
  if (autoFinishSummary.enabled) {
    console.log(
      `[${TOOL_NAME}] Auto-finish sweep (base=${currentBaseBranch}): attempted=${autoFinishSummary.attempted}, completed=${autoFinishSummary.completed}, skipped=${autoFinishSummary.skipped}, failed=${autoFinishSummary.failed}`,
    );
    for (const detail of autoFinishSummary.details) {
      console.log(`[${TOOL_NAME}]   ${detail}`);
    }
  } else if (autoFinishSummary.details.length > 0) {
    console.log(`[${TOOL_NAME}] ${autoFinishSummary.details[0]}`);
  }

  const cleanupResult = cleanupProtectedBaseSandbox(blocked.repoRoot, metadata);
  console.log(
    `[${TOOL_NAME}] Protected-base setup sandbox cleanup: ${cleanupResult.note} ` +
    `(worktree=${cleanupResult.worktree}, branch=${cleanupResult.branch}).`,
  );

  return {
    scanResult,
  };
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

function inferGithubRepoSlug(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  const match = raw.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  if (!match) return '';
  const slug = String(match[1] || '')
    .replace(/^\/+/, '')
    .replace(/^github\.com\//i, '')
    .trim();
  if (!slug || !slug.includes('/')) return '';
  return slug;
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

function readConfiguredProtectedBranches(repoRoot) {
  const result = gitRun(repoRoot, ['config', '--get', GIT_PROTECTED_BRANCHES_KEY], { allowFailure: true });
  if (result.status !== 0) {
    return null;
  }
  const parsed = uniquePreserveOrder(parseBranchList(result.stdout.trim()));
  if (parsed.length === 0) {
    return null;
  }
  return parsed;
}

function listLocalUserBranches(repoRoot) {
  const result = gitRun(repoRoot, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], { allowFailure: true });
  const branchNames = result.status === 0
    ? uniquePreserveOrder(
      String(result.stdout || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    : [];

  const additionalUserBranches = branchNames.filter(
    (branchName) =>
      !branchName.startsWith('agent/') &&
      !DEFAULT_PROTECTED_BRANCHES.includes(branchName),
  );
  if (additionalUserBranches.length > 0) {
    return additionalUserBranches;
  }

  const current = gitRun(repoRoot, ['branch', '--show-current'], { allowFailure: true });
  if (current.status !== 0) {
    return [];
  }

  const branchName = String(current.stdout || '').trim();
  if (
    !branchName ||
    branchName.startsWith('agent/') ||
    DEFAULT_PROTECTED_BRANCHES.includes(branchName)
  ) {
    return [];
  }

  return [branchName];
}

function listLocalAgentBranches(repoRoot) {
  const result = gitRun(
    repoRoot,
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads/agent/'],
    { allowFailure: true },
  );
  if (result.status !== 0) {
    return [];
  }
  return uniquePreserveOrder(
    String(result.stdout || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function mapWorktreePathsByBranch(repoRoot) {
  const result = gitRun(repoRoot, ['worktree', 'list', '--porcelain'], { allowFailure: true });
  const map = new Map();
  if (result.status !== 0) {
    return map;
  }

  const lines = String(result.stdout || '').split('\n');
  let currentWorktree = '';
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentWorktree = line.slice('worktree '.length).trim();
      continue;
    }
    if (line.startsWith('branch refs/heads/')) {
      const branchName = line.slice('branch refs/heads/'.length).trim();
      if (currentWorktree && branchName) {
        map.set(branchName, currentWorktree);
      }
    }
  }
  return map;
}

function hasSignificantWorkingTreeChanges(worktreePath) {
  const result = run('git', [
    '-C',
    worktreePath,
    'status',
    '--porcelain',
    '--untracked-files=normal',
    '--',
  ]);
  if (result.status !== 0) {
    return true;
  }

  const lines = String(result.stdout || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const pathPart = (line.length > 3 ? line.slice(3) : '').trim();
    if (!pathPart) continue;
    if (pathPart === LOCK_FILE_RELATIVE) continue;
    if (pathPart.startsWith(`${LOCK_FILE_RELATIVE} -> `)) continue;
    if (pathPart.endsWith(` -> ${LOCK_FILE_RELATIVE}`)) continue;
    return true;
  }
  return false;
}

function autoFinishReadyAgentBranches(repoRoot, options = {}) {
  const baseBranch = String(options.baseBranch || '').trim();
  const dryRun = Boolean(options.dryRun);
  const waitForMerge = options.waitForMerge !== false;
  const excludedBranches = new Set(
    Array.isArray(options.excludeBranches)
      ? options.excludeBranches.map((branch) => String(branch || '').trim()).filter(Boolean)
      : [],
  );

  const summary = {
    enabled: true,
    baseBranch,
    attempted: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  if (!baseBranch || baseBranch === 'HEAD' || baseBranch.startsWith('agent/')) {
    summary.enabled = false;
    summary.details.push('Skipped auto-finish sweep (base branch is missing or not a non-agent local branch).');
    return summary;
  }

  if (String(process.env.GUARDEX_DOCTOR_SANDBOX || '') === '1') {
    summary.enabled = false;
    summary.details.push('Skipped auto-finish sweep inside doctor sandbox pass.');
    return summary;
  }

  if (String(process.env.GUARDEX_SKIP_AUTO_FINISH_READY_BRANCHES || '') === '1') {
    summary.enabled = false;
    summary.details.push('Skipped auto-finish sweep (GUARDEX_SKIP_AUTO_FINISH_READY_BRANCHES=1).');
    return summary;
  }

  if (dryRun) {
    summary.enabled = false;
    summary.details.push('Skipped auto-finish sweep in dry-run mode.');
    return summary;
  }

  const hasOrigin = gitRun(repoRoot, ['remote', 'get-url', 'origin'], { allowFailure: true }).status === 0;
  if (!hasOrigin) {
    summary.enabled = false;
    summary.details.push('Skipped auto-finish sweep (origin remote missing).');
    return summary;
  }
  const explicitGhBin = Boolean(String(process.env.GUARDEX_GH_BIN || '').trim());
  if (!explicitGhBin && !originRemoteLooksLikeGithub(repoRoot)) {
    summary.enabled = false;
    summary.details.push('Skipped auto-finish sweep (origin remote is not GitHub).');
    return summary;
  }

  const ghBin = process.env.GUARDEX_GH_BIN || 'gh';
  if (run(ghBin, ['--version']).status !== 0) {
    summary.enabled = false;
    summary.details.push(`Skipped auto-finish sweep (${ghBin} not available).`);
    return summary;
  }

  const branchWorktrees = mapWorktreePathsByBranch(repoRoot);
  const agentBranches = listLocalAgentBranches(repoRoot);
  if (agentBranches.length === 0) {
    summary.enabled = false;
    summary.details.push('No local agent branches found for auto-finish sweep.');
    return summary;
  }

  for (const branch of agentBranches) {
    if (excludedBranches.has(branch)) {
      summary.skipped += 1;
      summary.details.push(`[skip] ${branch}: excluded from this auto-finish sweep.`);
      continue;
    }

    if (branch === baseBranch) {
      summary.skipped += 1;
      summary.details.push(`[skip] ${branch}: source branch equals base branch.`);
      continue;
    }

    let counts;
    try {
      counts = aheadBehind(repoRoot, branch, baseBranch);
    } catch (error) {
      summary.failed += 1;
      summary.details.push(`[fail] ${branch}: unable to compute ahead/behind (${error.message}).`);
      continue;
    }

    if (counts.ahead <= 0) {
      summary.skipped += 1;
      summary.details.push(`[skip] ${branch}: already merged into ${baseBranch}.`);
      continue;
    }

    const branchWorktree = branchWorktrees.get(branch) || '';
    if (branchWorktree && hasSignificantWorkingTreeChanges(branchWorktree)) {
      summary.skipped += 1;
      summary.details.push(`[skip] ${branch}: dirty worktree (${branchWorktree}).`);
      continue;
    }

    summary.attempted += 1;
    const finishArgs = [
      '--branch',
      branch,
      '--base',
      baseBranch,
      '--via-pr',
      waitForMerge ? '--wait-for-merge' : '--no-wait-for-merge',
      '--cleanup',
    ];
    const finishResult = runPackageAsset('branchFinish', finishArgs, { cwd: repoRoot });
    const combinedOutput = [finishResult.stdout || '', finishResult.stderr || ''].join('\n').trim();

    if (finishResult.status === 0) {
      summary.completed += 1;
      summary.details.push(`[done] ${branch}: auto-finish completed.`);
      continue;
    }

    const recoverableConflict = detectRecoverableAutoFinishConflict(combinedOutput);
    if (recoverableConflict) {
      summary.skipped += 1;
      const tail = combinedOutput ? ` ${combinedOutput.split('\n').slice(-2).join(' | ')}` : '';
      summary.details.push(`[skip] ${branch}: ${recoverableConflict.rawLabel}${tail}`);
      continue;
    }

    summary.failed += 1;
    const tail = combinedOutput ? ` ${combinedOutput.split('\n').slice(-2).join(' | ')}` : '';
    summary.details.push(`[fail] ${branch}: auto-finish failed.${tail}`);
  }

  return summary;
}

function ensureSetupProtectedBranches(repoRoot, dryRun) {
  const localUserBranches = listLocalUserBranches(repoRoot);
  if (localUserBranches.length === 0) {
    return {
      status: 'unchanged',
      file: `git config ${GIT_PROTECTED_BRANCHES_KEY}`,
      note: 'no additional local user branches detected',
    };
  }

  const configured = readConfiguredProtectedBranches(repoRoot);
  const currentBranches = configured || [...DEFAULT_PROTECTED_BRANCHES];
  const missingBranches = localUserBranches.filter((branchName) => !currentBranches.includes(branchName));
  if (missingBranches.length === 0) {
    return {
      status: 'unchanged',
      file: `git config ${GIT_PROTECTED_BRANCHES_KEY}`,
      note: 'local user branches already protected',
    };
  }

  const nextBranches = uniquePreserveOrder([...currentBranches, ...missingBranches]);
  if (!dryRun) {
    writeProtectedBranches(repoRoot, nextBranches);
  }

  return {
    status: dryRun ? 'would-update' : 'updated',
    file: `git config ${GIT_PROTECTED_BRANCHES_KEY}`,
    note: `added local user branch(es): ${missingBranches.join(', ')}`,
  };
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

function repoHasHeadCommit(repoRoot) {
  return gitRun(repoRoot, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true }).status === 0;
}

function readBranchDisplayName(repoRoot) {
  const symbolic = gitRun(repoRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true });
  if (symbolic.status === 0) {
    const branch = String(symbolic.stdout || '').trim();
    if (!branch) {
      return '(unknown)';
    }
    return repoHasHeadCommit(repoRoot) ? branch : `${branch} (unborn; no commits yet)`;
  }

  const detached = gitRun(repoRoot, ['rev-parse', '--short', 'HEAD'], { allowFailure: true });
  if (detached.status === 0) {
    return `(detached at ${String(detached.stdout || '').trim()})`;
  }
  return '(unknown)';
}

function repoHasOriginRemote(repoRoot) {
  return gitRun(repoRoot, ['remote', 'get-url', 'origin'], { allowFailure: true }).status === 0;
}

function detectComposeHintFiles(repoRoot) {
  return COMPOSE_HINT_FILES.filter((relativePath) => fs.existsSync(path.join(repoRoot, relativePath)));
}

function printSetupRepoHints(repoRoot, baseBranch, repoLabel = '') {
  const branchDisplay = readBranchDisplayName(repoRoot);
  const hasHeadCommit = repoHasHeadCommit(repoRoot);
  const hasOrigin = repoHasOriginRemote(repoRoot);
  const composeFiles = detectComposeHintFiles(repoRoot);
  if (hasHeadCommit && hasOrigin && composeFiles.length === 0) {
    return;
  }

  const label = repoLabel ? ` ${repoLabel}` : '';
  if (!hasHeadCommit) {
    console.log(`[${TOOL_NAME}] Fresh repo onboarding${label}: current branch is ${branchDisplay}.`);
    console.log(`[${TOOL_NAME}] Bootstrap commit${label}: git add . && git commit -m "bootstrap gitguardex"`);
    console.log(
      `[${TOOL_NAME}] First agent flow${label}: ` +
      `gx branch start "<task>" "codex" -> ` +
      `gx locks claim --branch "$(git branch --show-current)" <file...> -> ` +
      `gx branch finish --branch "$(git branch --show-current)" --base ${baseBranch} --via-pr --wait-for-merge`,
    );
  }
  if (!hasOrigin) {
    console.log(`[${TOOL_NAME}] No origin remote${label}: finish and auto-merge flows stay local until you add one.`);
  }
  if (composeFiles.length > 0) {
    console.log(
      `[${TOOL_NAME}] Docker Compose helper${label}: detected ${composeFiles.join(', ')}. ` +
      `Set GUARDEX_DOCKER_SERVICE and run 'bash scripts/guardex-docker-loader.sh -- <command...>'.`,
    );
  }
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


function listAgentWorktrees(repoRoot) {
  const result = gitRun(repoRoot, ['worktree', 'list', '--porcelain'], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error('Unable to list git worktrees for finish command');
  }

  const entries = [];
  let currentPath = '';
  let currentBranchRef = '';
  const lines = String(result.stdout || '').split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      if (currentPath && currentBranchRef.startsWith('refs/heads/agent/')) {
        entries.push({
          worktreePath: currentPath,
          branch: currentBranchRef.replace(/^refs\/heads\//, ''),
        });
      }
      currentPath = '';
      currentBranchRef = '';
      continue;
    }
    if (line.startsWith('worktree ')) {
      currentPath = line.slice('worktree '.length).trim();
      continue;
    }
    if (line.startsWith('branch ')) {
      currentBranchRef = line.slice('branch '.length).trim();
      continue;
    }
  }
  if (currentPath && currentBranchRef.startsWith('refs/heads/agent/')) {
    entries.push({
      worktreePath: currentPath,
      branch: currentBranchRef.replace(/^refs\/heads\//, ''),
    });
  }

  return entries;
}

function listLocalAgentBranchesForFinish(repoRoot) {
  const result = gitRun(
    repoRoot,
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads/agent/'],
    { allowFailure: true },
  );
  if (result.status !== 0) {
    throw new Error('Unable to list local agent branches');
  }
  return uniquePreserveOrder(
    String(result.stdout || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('agent/')),
  );
}

function gitQuietChangeResult(worktreePath, args) {
  const result = run('git', ['-C', worktreePath, ...args], { stdio: 'pipe' });
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }
  throw new Error(
    `git ${args.join(' ')} failed in ${worktreePath}: ${(
      result.stderr || result.stdout || ''
    ).trim()}`,
  );
}

function worktreeHasLocalChanges(worktreePath) {
  const hasUnstaged = gitQuietChangeResult(worktreePath, [
    'diff',
    '--quiet',
    '--',
    '.',
    ':(exclude).omx/state/agent-file-locks.json',
  ]);
  if (hasUnstaged) {
    return true;
  }

  const hasStaged = gitQuietChangeResult(worktreePath, [
    'diff',
    '--cached',
    '--quiet',
    '--',
    '.',
    ':(exclude).omx/state/agent-file-locks.json',
  ]);
  if (hasStaged) {
    return true;
  }

  const untracked = run('git', ['-C', worktreePath, 'ls-files', '--others', '--exclude-standard'], {
    stdio: 'pipe',
  });
  if (untracked.status !== 0) {
    throw new Error(`Unable to inspect untracked files in ${worktreePath}`);
  }
  return String(untracked.stdout || '').trim().length > 0;
}

function gitOutputLines(worktreePath, args) {
  const result = run('git', ['-C', worktreePath, ...args], { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed in ${worktreePath}: ${(
        result.stderr || result.stdout || ''
      ).trim()}`,
    );
  }
  return String(result.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function claimLocksForAutoCommit(repoRoot, worktreePath, branch) {
  const changedFiles = uniquePreserveOrder([
    ...gitOutputLines(worktreePath, ['diff', '--name-only', '--', '.', ':(exclude).omx/state/agent-file-locks.json']),
    ...gitOutputLines(worktreePath, ['diff', '--cached', '--name-only', '--', '.', ':(exclude).omx/state/agent-file-locks.json']),
    ...gitOutputLines(worktreePath, ['ls-files', '--others', '--exclude-standard']),
  ]);

  if (changedFiles.length > 0) {
    const claim = runPackageAsset('lockTool', ['claim', '--branch', branch, ...changedFiles], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    if (claim.status !== 0) {
      throw new Error(
        `Lock claim failed for ${branch}: ${(
          claim.stderr || claim.stdout || ''
        ).trim()}`,
      );
    }
  }

  const deletedFiles = uniquePreserveOrder([
    ...gitOutputLines(worktreePath, [
      'diff',
      '--name-only',
      '--diff-filter=D',
      '--',
      '.',
      ':(exclude).omx/state/agent-file-locks.json',
    ]),
    ...gitOutputLines(worktreePath, [
      'diff',
      '--cached',
      '--name-only',
      '--diff-filter=D',
      '--',
      '.',
      ':(exclude).omx/state/agent-file-locks.json',
    ]),
  ]);

  if (deletedFiles.length > 0) {
    const allowDelete = runPackageAsset('lockTool', ['allow-delete', '--branch', branch, ...deletedFiles], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    if (allowDelete.status !== 0) {
      throw new Error(
        `Delete-lock grant failed for ${branch}: ${(
          allowDelete.stderr || allowDelete.stdout || ''
        ).trim()}`,
      );
    }
  }
}

function branchExists(repoRoot, branch) {
  const result = gitRun(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    allowFailure: true,
  });
  return result.status === 0;
}

function resolveFinishBaseBranch(repoRoot, _sourceBranch, explicitBase) {
  if (explicitBase) {
    return explicitBase;
  }

  const configured = readGitConfig(repoRoot, GIT_BASE_BRANCH_KEY);
  if (configured) {
    return configured;
  }

  return DEFAULT_BASE_BRANCH;
}

function branchMergedIntoBase(repoRoot, branch, baseBranch) {
  if (!branchExists(repoRoot, baseBranch)) {
    return false;
  }
  const result = gitRun(repoRoot, ['merge-base', '--is-ancestor', branch, baseBranch], {
    allowFailure: true,
  });
  if (result.status === 0) {
    return true;
  }
  if (result.status === 1) {
    return false;
  }
  throw new Error(`Unable to determine merge status for ${branch} -> ${baseBranch}`);
}

function autoCommitWorktreeForFinish(repoRoot, worktreePath, branch, options) {
  const hasChanges = worktreeHasLocalChanges(worktreePath);
  if (!hasChanges) {
    return { changed: false, committed: false };
  }

  if (options.noAutoCommit) {
    throw new Error(
      `Branch '${branch}' has local changes in ${worktreePath}. Re-run without --no-auto-commit or commit manually first.`,
    );
  }

  if (options.dryRun) {
    return { changed: true, committed: false, dryRun: true };
  }

  claimLocksForAutoCommit(repoRoot, worktreePath, branch);

  const addResult = run('git', ['-C', worktreePath, 'add', '-A'], { stdio: 'pipe' });
  if (addResult.status !== 0) {
    throw new Error(`git add failed in ${worktreePath}: ${(addResult.stderr || addResult.stdout || '').trim()}`);
  }

  const stagedHasChanges = gitQuietChangeResult(worktreePath, [
    'diff',
    '--cached',
    '--quiet',
    '--',
    '.',
    ':(exclude).omx/state/agent-file-locks.json',
  ]);
  if (!stagedHasChanges) {
    return { changed: true, committed: false };
  }

  const commitMessage = options.commitMessage || `Auto-finish: ${branch}`;
  const commitResult = run('git', ['-C', worktreePath, 'commit', '-m', commitMessage], { stdio: 'pipe' });
  if (commitResult.status !== 0) {
    throw new Error(
      `Auto-commit failed on '${branch}': ${(
        commitResult.stderr || commitResult.stdout || ''
      ).trim()}`,
    );
  }

  return { changed: true, committed: true, message: commitMessage };
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

const stdinWaitArray = new Int32Array(new SharedArrayBuffer(4));

function sleepSyncMs(milliseconds) {
  Atomics.wait(stdinWaitArray, 0, 0, milliseconds);
}

function readSingleLineFromStdin() {
  let input = '';
  const buffer = Buffer.alloc(1);

  while (true) {
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(process.stdin.fd, buffer, 0, 1);
    } catch (error) {
      if (error && ['EAGAIN', 'EWOULDBLOCK', 'EINTR'].includes(error.code)) {
        sleepSyncMs(15);
        continue;
      }
      return input;
    }

    if (bytesRead === 0) {
      if (process.stdin.isTTY) {
        sleepSyncMs(15);
        continue;
      }
      return input;
    }

    const char = buffer.toString('utf8', 0, bytesRead);
    if (char === '\n' || char === '\r') {
      return input;
    }
    input += char;
  }
}

function parseAutoApproval(name) {
  const raw = process.env[name];
  if (raw == null) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
}

function parseBooleanLike(raw) {
  if (raw == null) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
}

function parseDotenvAssignmentValue(raw) {
  let value = String(raw || '').trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return value.slice(1, -1).trim();
  }
  value = value.replace(/\s+#.*$/, '').trim();
  return value;
}

function readRepoDotenvValue(repoRoot, name) {
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) return null;
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(.*)$`);
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(pattern);
    if (!match) continue;
    return parseDotenvAssignmentValue(match[1]);
  }
  return null;
}

function resolveGuardexRepoToggle(repoRoot, env = process.env) {
  const envRaw = env[GUARDEX_REPO_TOGGLE_ENV];
  const envEnabled = parseBooleanLike(envRaw);
  if (envEnabled !== null) {
    return {
      enabled: envEnabled,
      source: 'process environment',
      raw: String(envRaw).trim(),
    };
  }

  const dotenvRaw = readRepoDotenvValue(repoRoot, GUARDEX_REPO_TOGGLE_ENV);
  const dotenvEnabled = parseBooleanLike(dotenvRaw);
  if (dotenvEnabled !== null) {
    return {
      enabled: dotenvEnabled,
      source: 'repo .env',
      raw: String(dotenvRaw).trim(),
    };
  }

  return {
    enabled: true,
    source: 'default',
    raw: '',
  };
}

function describeGuardexRepoToggle(toggle) {
  if (!toggle || toggle.source === 'default') {
    return 'default enabled mode';
  }
  return `${toggle.source} (${GUARDEX_REPO_TOGGLE_ENV}=${toggle.raw})`;
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

function compareParsedVersions(left, right) {
  if (!left || !right) return 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function isNewerVersion(latest, current) {
  const latestParts = parseVersionString(latest);
  const currentParts = parseVersionString(current);

  if (!latestParts || !currentParts) {
    return String(latest || '').trim() !== String(current || '').trim();
  }

  return compareParsedVersions(latestParts, currentParts) > 0;
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

function checkForGuardexUpdate() {
  if (parseBooleanLike(process.env.GUARDEX_SKIP_UPDATE_CHECK) === true) {
    return { checked: false, reason: 'disabled' };
  }

  const forceCheck = parseBooleanLike(process.env.GUARDEX_FORCE_UPDATE_CHECK) === true;
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
  return getToolchainApi().maybeSelfUpdateBeforeStatus();
}

function readInstalledGuardexVersion() {
  const installInfo = readInstalledGuardexInstallInfo();
  return installInfo ? installInfo.version : null;
}

function readInstalledGuardexInstallInfo() {
  // Resolves the globally-installed package's on-disk version so we can
  // verify npm actually wrote new bytes. Uses `npm root -g` to locate the
  // global install root so we don't accidentally read the running source
  // tree (which is the file the CLI was spawned from — that IS the global
  // copy in the normal case, but a bump should be visible via a fresh read
  // either way). Returns null if we can't determine it.
  try {
    const rootResult = run(NPM_BIN, ['root', '-g'], { timeout: 5000 });
    if (rootResult.status !== 0) {
      return null;
    }
    const globalRoot = String(rootResult.stdout || '').trim();
    if (!globalRoot) {
      return null;
    }
    const installedPkgPath = path.join(globalRoot, packageJson.name, 'package.json');
    if (!fs.existsSync(installedPkgPath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8'));
    if (parsed && typeof parsed.version === 'string') {
      let binRelative = null;
      if (typeof parsed.bin === 'string') {
        binRelative = parsed.bin;
      } else if (parsed.bin && typeof parsed.bin === 'object') {
        const invokedName = path.basename(process.argv[1] || '');
        binRelative =
          parsed.bin[invokedName] ||
          parsed.bin[SHORT_TOOL_NAME] ||
          Object.values(parsed.bin).find((value) => typeof value === 'string') ||
          null;
      }
      const packageRoot = path.dirname(installedPkgPath);
      const binPath = binRelative ? path.join(packageRoot, binRelative) : null;
      return {
        version: parsed.version,
        packageRoot,
        binPath,
      };
    }
  } catch (error) {
    return null;
  }
  return null;
}

function restartIntoUpdatedGuardex(expectedVersion) {
  const installInfo = readInstalledGuardexInstallInfo();
  if (!installInfo || installInfo.version !== expectedVersion || installInfo.version === packageJson.version) {
    return;
  }
  if (!installInfo.binPath || !fs.existsSync(installInfo.binPath)) {
    console.log(`[${TOOL_NAME}] Restart required to use ${installInfo.version}. Rerun ${SHORT_TOOL_NAME}.`);
    return;
  }

  console.log(`[${TOOL_NAME}] Restarting into ${installInfo.version}…`);
  const restartResult = cp.spawnSync(
    process.execPath,
    [installInfo.binPath, ...process.argv.slice(2)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GUARDEX_SKIP_UPDATE_CHECK: '1',
      },
      stdio: 'inherit',
    },
  );
  if (restartResult.error) {
    console.log(
      `[${TOOL_NAME}] Restart into ${installInfo.version} failed. Rerun ${SHORT_TOOL_NAME}.`,
    );
    return;
  }
  process.exit(restartResult.status == null ? 0 : restartResult.status);
}

function checkForOpenSpecPackageUpdate() {
  if (parseBooleanLike(process.env.GUARDEX_SKIP_OPENSPEC_UPDATE_CHECK) === true) {
    return { checked: false, reason: 'disabled' };
  }

  const forceCheck =
    parseBooleanLike(process.env.GUARDEX_FORCE_OPENSPEC_UPDATE_CHECK) === true;
  if (!forceCheck && !isInteractiveTerminal()) {
    return { checked: false, reason: 'non-interactive' };
  }

  const detection = detectGlobalToolchainPackages();
  if (!detection.ok) {
    return { checked: false, reason: 'package-detect-failed' };
  }

  const current = String((detection.installedVersions || {})[OPENSPEC_PACKAGE] || '').trim();
  if (!current) {
    return { checked: false, reason: 'not-installed' };
  }

  const latestResult = run(NPM_BIN, ['view', OPENSPEC_PACKAGE, 'version', '--json'], { timeout: 5000 });
  if (latestResult.status !== 0) {
    return { checked: false, reason: 'lookup-failed' };
  }

  const latest = parseNpmVersionOutput(latestResult.stdout);
  if (!latest) {
    return { checked: false, reason: 'invalid-latest-version' };
  }

  return {
    checked: true,
    current,
    latest,
    updateAvailable: isNewerVersion(latest, current),
  };
}

function printOpenSpecUpdateAvailableBanner(current, latest) {
  const title = colorize('OPENSPEC UPDATE AVAILABLE', '1;33');
  console.log(`[${TOOL_NAME}] ${title}`);
  console.log(`[${TOOL_NAME}]   Current: ${current}`);
  console.log(`[${TOOL_NAME}]   Latest : ${latest}`);
  console.log(`[${TOOL_NAME}]   Command: ${NPM_BIN} i -g ${OPENSPEC_PACKAGE}@latest`);
  console.log(`[${TOOL_NAME}]   Then   : ${OPENSPEC_BIN} update`);
}

function maybeOpenSpecUpdateBeforeStatus() {
  return getToolchainApi().maybeOpenSpecUpdateBeforeStatus();
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

function getGlobalToolchainService(packageName) {
  const service = GLOBAL_TOOLCHAIN_SERVICES.find(
    (candidate) => candidate.packageName === packageName,
  );
  return service || { name: packageName, packageName };
}

function formatGlobalToolchainServiceName(packageName) {
  return getGlobalToolchainService(packageName).name;
}

function describeMissingGlobalDependencyWarnings(packageNames) {
  return packageNames
    .map((packageName) => getGlobalToolchainService(packageName))
    .filter((service) => service.dependencyUrl)
    .map(
      (service) =>
        `Guardex needs ${service.name} as a dependency: ${service.dependencyUrl}`,
    );
}

function buildMissingCompanionInstallPrompt(missingPackages, missingLocalTools) {
  const dependencyWarnings = describeMissingGlobalDependencyWarnings(missingPackages);
  const installCommands = describeCompanionInstallCommands(missingPackages, missingLocalTools);
  const dependencyPrefix = dependencyWarnings.length > 0
    ? `${dependencyWarnings.join(' ')} `
    : '';
  return `${dependencyPrefix}Install missing companion tools now? (${installCommands.join(' && ')})`;
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
  const installedVersions = {};
  for (const pkg of GLOBAL_TOOLCHAIN_PACKAGES) {
    if (installedSet.has(pkg)) {
      installed.push(pkg);
      const rawVersion = dependencyMap[pkg] && dependencyMap[pkg].version;
      const version = String(rawVersion || '').trim();
      if (version) {
        installedVersions[pkg] = version;
      }
    } else {
      missing.push(pkg);
    }
  }

  return { ok: true, installed, missing, installedVersions };
}

function detectRequiredSystemTools() {
  const services = [];
  for (const tool of REQUIRED_SYSTEM_TOOLS) {
    const result = run(tool.command, ['--version']);
    const active = result.status === 0;
    const rawReason = result.error && result.error.code
      ? result.error.code
      : (result.stderr || '').trim();
    const reason = rawReason.split('\n')[0] || '';
    services.push({
      name: tool.name,
      displayName: tool.displayName || tool.name,
      command: tool.command,
      installHint: tool.installHint,
      status: active ? 'active' : 'inactive',
      reason,
    });
  }
  return services;
}

function detectOptionalLocalCompanionTools() {
  return OPTIONAL_LOCAL_COMPANION_TOOLS.map((tool) => {
    const detectedPath = tool.candidatePaths
      .map((relativePath) => path.join(GUARDEX_HOME_DIR, relativePath))
      .find((candidatePath) => fs.existsSync(candidatePath));
    return {
      name: tool.name,
      displayName: tool.displayName || tool.name,
      installCommand: tool.installCommand,
      installArgs: [...tool.installArgs],
      status: detectedPath ? 'active' : 'inactive',
      detectedPath: detectedPath || null,
    };
  });
}

function describeCompanionInstallCommands(missingPackages, missingLocalTools) {
  const commands = [];
  if (missingPackages.length > 0) {
    commands.push(`${NPM_BIN} i -g ${missingPackages.join(' ')}`);
  }
  for (const tool of missingLocalTools) {
    commands.push(tool.installCommand);
  }
  return commands;
}

function askGlobalInstallForMissing(options, missingPackages, missingLocalTools) {
  const approval = resolveGlobalInstallApproval(options);
  if (!approval.approved) {
    return approval;
  }

  if (approval.source === 'prompt') {
    const approved = promptYesNoStrict(
      buildMissingCompanionInstallPrompt(missingPackages, missingLocalTools),
    );
    return { approved, source: 'prompt' };
  }

  return approval;
}

function installGlobalToolchain(options) {
  return getToolchainApi().installGlobalToolchain(options);
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
  const guardexToggle = resolveGuardexRepoToggle(repoRoot);
  if (!guardexToggle.enabled) {
    return {
      repoRoot,
      operations: [
        {
          status: 'skipped',
          file: '.env',
          note: `Guardex disabled by ${describeGuardexRepoToggle(guardexToggle)}`,
        },
      ],
      hookResult: { status: 'skipped', key: 'core.hooksPath', value: '(unchanged)' },
      guardexEnabled: false,
      guardexToggle,
    };
  }
  const operations = [];

  if (!options.skipGitignore) {
    operations.push(ensureManagedGitignore(repoRoot, Boolean(options.dryRun)));
  }
  operations.push(ensureRepoVscodeSettings(repoRoot, Boolean(options.dryRun)));

  operations.push(...ensureOmxScaffold(repoRoot, Boolean(options.dryRun)));

  for (const templateFile of TEMPLATE_FILES) {
    operations.push(
      copyTemplateFile(
        repoRoot,
        templateFile,
        shouldForceManagedPath(options, toDestinationPath(templateFile)),
        Boolean(options.dryRun),
      ),
    );
  }
  operations.push(...ensureTargetedLegacyWorkflowShims(repoRoot, options));
  for (const hookName of HOOK_NAMES) {
    const hookRelativePath = path.posix.join('.githooks', hookName);
    operations.push(
      ensureHookShim(repoRoot, hookName, {
        dryRun: options.dryRun,
        force: shouldForceManagedPath(options, hookRelativePath),
      }),
    );
  }

  operations.push(ensureLockRegistry(repoRoot, Boolean(options.dryRun)));

  if (!options.skipAgents) {
    operations.push(ensureAgentsSnippet(repoRoot, Boolean(options.dryRun), { force: Boolean(options.force) }));
  }

  const hookResult = configureHooks(repoRoot, Boolean(options.dryRun));

  return { repoRoot, operations, hookResult, guardexEnabled: true, guardexToggle };
}

function runFixInternal(options) {
  const repoRoot = resolveRepoRoot(options.target);
  const guardexToggle = resolveGuardexRepoToggle(repoRoot);
  if (!guardexToggle.enabled) {
    return {
      repoRoot,
      operations: [
        {
          status: 'skipped',
          file: '.env',
          note: `Guardex disabled by ${describeGuardexRepoToggle(guardexToggle)}`,
        },
      ],
      hookResult: { status: 'skipped', key: 'core.hooksPath', value: '(unchanged)' },
      guardexEnabled: false,
      guardexToggle,
    };
  }
  const operations = [];

  if (!options.skipGitignore) {
    operations.push(ensureManagedGitignore(repoRoot, Boolean(options.dryRun)));
  }
  operations.push(ensureRepoVscodeSettings(repoRoot, Boolean(options.dryRun)));

  operations.push(...ensureOmxScaffold(repoRoot, Boolean(options.dryRun)));

  for (const templateFile of TEMPLATE_FILES) {
    if (shouldForceManagedPath(options, toDestinationPath(templateFile))) {
      operations.push(copyTemplateFile(repoRoot, templateFile, true, Boolean(options.dryRun)));
      continue;
    }
    operations.push(ensureTemplateFilePresent(repoRoot, templateFile, Boolean(options.dryRun)));
  }
  operations.push(...ensureTargetedLegacyWorkflowShims(repoRoot, options));
  for (const hookName of HOOK_NAMES) {
    const hookRelativePath = path.posix.join('.githooks', hookName);
    operations.push(
      ensureHookShim(repoRoot, hookName, {
        dryRun: options.dryRun,
        force: shouldForceManagedPath(options, hookRelativePath),
      }),
    );
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

  if (!options.skipAgents) {
    operations.push(ensureAgentsSnippet(repoRoot, Boolean(options.dryRun), { force: Boolean(options.force) }));
  }

  const hookResult = configureHooks(repoRoot, Boolean(options.dryRun));

  return { repoRoot, operations, hookResult, guardexEnabled: true, guardexToggle };
}

function runScanInternal(options) {
  const repoRoot = resolveRepoRoot(options.target);
  const guardexToggle = resolveGuardexRepoToggle(repoRoot);
  const branch = readBranchDisplayName(repoRoot);
  if (!guardexToggle.enabled) {
    return {
      repoRoot,
      branch,
      findings: [],
      errors: 0,
      warnings: 0,
      guardexEnabled: false,
      guardexToggle,
    };
  }
  const findings = [];

  const requiredPaths = [
    ...OMX_SCAFFOLD_DIRECTORIES,
    ...Array.from(OMX_SCAFFOLD_FILES.keys()),
    ...REQUIRED_MANAGED_REPO_FILES,
  ];

  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      findings.push({
        level: 'error',
        code: 'missing-managed-file',
        path: relativePath,
        message: `Missing managed repo file: ${relativePath}`,
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

  return {
    repoRoot,
    branch,
    findings,
    errors: errors.length,
    warnings: warnings.length,
    guardexEnabled: true,
    guardexToggle,
  };
}

function printScanResult(scan, json = false) {
  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          repoRoot: scan.repoRoot,
          branch: scan.branch,
          guardexEnabled: scan.guardexEnabled !== false,
          guardexToggle: scan.guardexToggle || null,
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

  if (scan.guardexEnabled === false) {
    console.log(
      colorizeDoctorOutput(
        `[${TOOL_NAME}] Guardex is disabled for this repo (${describeGuardexRepoToggle(scan.guardexToggle)}).`,
        'disabled',
      ),
    );
    return;
  }

  if (scan.findings.length === 0) {
    console.log(colorizeDoctorOutput(`[${TOOL_NAME}] ✅ No safety issues detected.`, 'safe'));
    return;
  }

  for (const item of scan.findings) {
    const target = item.path ? ` (${item.path})` : '';
    console.log(
      colorizeDoctorOutput(
        `[${item.level.toUpperCase()}] ${item.code}${target}: ${item.message}`,
        item.level,
      ),
    );
  }
  console.log(
    colorizeDoctorOutput(
      `[${TOOL_NAME}] Summary: ${scan.errors} error(s), ${scan.warnings} warning(s).`,
      scan.errors > 0 ? 'error' : 'warn',
    ),
  );
}

function setExitCodeFromScan(scan) {
  if (scan.guardexEnabled === false) {
    process.exitCode = 0;
    return;
  }
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
  const npmServices = GLOBAL_TOOLCHAIN_PACKAGES.map((pkg) => {
    const service = getGlobalToolchainService(pkg);
    if (!toolchain.ok) {
      return {
        name: service.name,
        displayName: service.name,
        packageName: pkg,
        dependencyUrl: service.dependencyUrl || null,
        status: 'unknown',
      };
    }
    return {
      name: service.name,
      displayName: service.name,
      packageName: pkg,
      dependencyUrl: service.dependencyUrl || null,
      status: toolchain.installed.includes(pkg) ? 'active' : 'inactive',
    };
  });
  const localCompanionServices = detectOptionalLocalCompanionTools().map((tool) => ({
    name: tool.name,
    displayName: tool.displayName || tool.name,
    status: tool.status,
  }));
  const requiredSystemTools = detectRequiredSystemTools();
  const services = [
    ...npmServices,
    ...localCompanionServices,
    ...requiredSystemTools.map((tool) => ({
      name: tool.name,
      displayName: tool.displayName || tool.name,
      status: tool.status,
    })),
  ];

  const targetPath = path.resolve(options.target);
  const inGitRepo = isGitRepo(targetPath);
  const scanResult = inGitRepo ? runScanInternal({ target: targetPath, json: false }) : null;
  const repoServiceStatus = scanResult
    ? (scanResult.guardexEnabled === false
      ? 'disabled'
      : (scanResult.errors === 0 && scanResult.warnings === 0 ? 'active' : 'degraded'))
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
      guardexEnabled: scanResult ? scanResult.guardexEnabled !== false : null,
      guardexToggle: scanResult ? scanResult.guardexToggle || null : null,
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
    const serviceLabel = service.displayName || service.name;
    console.log(`  - ${statusDot(service.status)} ${serviceLabel}: ${service.status}`);
  }
  const inactiveOptionalCompanions = [...npmServices, ...localCompanionServices]
    .filter((service) => service.status !== 'active')
    .map((service) => service.displayName || service.name);
  if (inactiveOptionalCompanions.length > 0) {
    console.log(
      `[${TOOL_NAME}] Optional companion tools inactive: ${inactiveOptionalCompanions.join(', ')}`,
    );
    for (const warning of describeMissingGlobalDependencyWarnings(
      npmServices
        .filter((service) => service.status === 'inactive')
        .map((service) => service.packageName),
    )) {
      console.log(`[${TOOL_NAME}] ${warning}`);
    }
    console.log(
      `[${TOOL_NAME}] Run '${SHORT_TOOL_NAME} setup' to install missing companions with an explicit Y/N prompt.`,
    );
  }
  const missingSystemTools = requiredSystemTools.filter((tool) => tool.status !== 'active');
  if (missingSystemTools.length > 0) {
    const tools = missingSystemTools
      .map((tool) => tool.displayName || tool.name)
      .join(', ');
    console.log(`[${TOOL_NAME}] ⚠️ Missing required system tool(s): ${tools}`);
    for (const tool of missingSystemTools) {
      const reasonText = tool.reason ? ` (${tool.reason})` : '';
      console.log(`  - install ${tool.name}: ${tool.installHint}${reasonText}`);
    }
  }

  if (!scanResult) {
    console.log(
      `[${TOOL_NAME}] Repo safety service: ${statusDot('inactive')} inactive (no git repository at target).`,
    );
    process.exitCode = 0;
    return;
  }

  if (scanResult.guardexEnabled === false) {
    console.log(
      `[${TOOL_NAME}] Repo safety service: ${statusDot('disabled')} disabled (${describeGuardexRepoToggle(scanResult.guardexToggle)}).`,
    );
    console.log(`[${TOOL_NAME}] Repo: ${scanResult.repoRoot}`);
    console.log(`[${TOOL_NAME}] Branch: ${scanResult.branch}`);
    printToolLogsSummary();
    process.exitCode = 0;
    return;
  }

  if (scanResult.errors === 0 && scanResult.warnings === 0) {
    console.log(`[${TOOL_NAME}] Repo safety service: ${statusDot('active')} active.`);
  } else if (scanResult.errors === 0) {
    console.log(
      `[${TOOL_NAME}] Repo safety service: ${statusDot('degraded')} degraded (${scanResult.warnings} warning(s)).`,
    );
    console.log(`[${TOOL_NAME}] Run '${TOOL_NAME} scan' to review warning details.`);
  } else if (scanResult.warnings === 0) {
    console.log(
      `[${TOOL_NAME}] Repo safety service: ${statusDot('degraded')} degraded (${scanResult.errors} error(s)).`,
    );
    console.log(`[${TOOL_NAME}] Run '${TOOL_NAME} scan' for detailed findings.`);
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
    allowProtectedBaseWrite: false,
  });

  assertProtectedMainWriteAllowed(options, 'install');
  const payload = runInstallInternal(options);
  printOperations('Install target', payload, options.dryRun);

  if (!options.dryRun) {
    if (payload.guardexEnabled === false) {
      console.log(
        `[${TOOL_NAME}] Guardex is disabled for this repo (${describeGuardexRepoToggle(payload.guardexToggle)}). Skipping repo bootstrap.`,
      );
      process.exitCode = 0;
      return;
    }
    if (!options.skipAgents) {
      console.log(`[${TOOL_NAME}] AGENTS.md managed policy block is configured by install.`);
    }
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
    allowProtectedBaseWrite: false,
  });

  assertProtectedMainWriteAllowed(options, 'fix');
  const payload = runFixInternal(options);
  printOperations('Fix target', payload, options.dryRun);

  if (!options.dryRun) {
    if (payload.guardexEnabled === false) {
      console.log(
        `[${TOOL_NAME}] Guardex is disabled for this repo (${describeGuardexRepoToggle(payload.guardexToggle)}). Skipping repo repair.`,
      );
      process.exitCode = 0;
      return;
    }
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
  const options = parseDoctorArgs(rawArgs);
  const topRepoRoot = resolveRepoRoot(options.target);
  const discoveredRepos = options.recursive
    ? discoverNestedGitRepos(topRepoRoot, {
        maxDepth: options.nestedMaxDepth,
        extraSkip: options.nestedSkipDirs,
        includeSubmodules: options.includeSubmodules,
        skipRelativeDirs: AGENT_WORKTREE_RELATIVE_DIRS,
      })
    : [topRepoRoot];

  if (discoveredRepos.length > 1) {
    if (!options.json) {
      console.log(
        `[${TOOL_NAME}] Detected ${discoveredRepos.length} git repos under ${topRepoRoot}. ` +
        `Repairing each with doctor (use --single-repo or --current to limit to the target).`,
      );
    }

    const repoResults = [];
    let aggregateExitCode = 0;
    for (let repoIndex = 0; repoIndex < discoveredRepos.length; repoIndex += 1) {
      const repoPath = discoveredRepos[repoIndex];
      const progressLabel = `${repoIndex + 1}/${discoveredRepos.length}`;
      if (!options.json) {
        console.log(`[${TOOL_NAME}] ── Doctor target: ${repoPath} [${progressLabel}] ──`);
      }

      const childArgs = [
        path.resolve(__filename),
        'doctor',
        '--single-repo',
        '--target',
        repoPath,
        ...(options.force ? ['--force', ...(options.forceManagedPaths || [])] : []),
        ...(options.dropStaleLocks ? [] : ['--keep-stale-locks']),
        ...(options.skipAgents ? ['--skip-agents'] : []),
        ...(options.skipPackageJson ? ['--skip-package-json'] : []),
        ...(options.skipGitignore ? ['--no-gitignore'] : []),
        ...(options.dryRun ? ['--dry-run'] : []),
        // Recursive child doctor runs should report pending PR state immediately instead of blocking the parent loop.
        '--no-wait-for-merge',
        ...(options.verboseAutoFinish ? ['--verbose-auto-finish'] : []),
        ...(options.json ? ['--json'] : []),
        ...(options.allowProtectedBaseWrite ? ['--allow-protected-base-write'] : []),
      ];
      const startedAt = Date.now();
      const nestedResult = options.json
        ? run(process.execPath, childArgs, { cwd: topRepoRoot })
        : cp.spawnSync(process.execPath, childArgs, {
          cwd: topRepoRoot,
          encoding: 'utf8',
          stdio: 'inherit',
        });
      if (isSpawnFailure(nestedResult)) {
        throw nestedResult.error;
      }

      const exitCode = typeof nestedResult.status === 'number' ? nestedResult.status : 1;
      if (exitCode !== 0 && aggregateExitCode === 0) {
        aggregateExitCode = exitCode;
      }

      if (options.json) {
        let parsedResult = null;
        if (nestedResult.stdout) {
          try {
            parsedResult = JSON.parse(nestedResult.stdout);
          } catch {
            parsedResult = null;
          }
        }
        repoResults.push(
          parsedResult
            ? { repoRoot: repoPath, exitCode, result: parsedResult }
            : {
              repoRoot: repoPath,
              exitCode,
              stdout: nestedResult.stdout || '',
              stderr: nestedResult.stderr || '',
            },
        );
      } else {
        console.log(
          `[${TOOL_NAME}] Doctor target complete: ${repoPath} [${progressLabel}] in ${formatElapsedDuration(Date.now() - startedAt)}.`,
        );
        if (repoIndex < discoveredRepos.length - 1) {
          process.stdout.write('\n');
        }
      }
    }

    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          {
            repoRoot: topRepoRoot,
            recursive: true,
            repos: repoResults,
          },
          null,
          2,
        ) + '\n',
      );
    }

    process.exitCode = aggregateExitCode;
    return;
  }

  const singleRepoOptions = {
    ...options,
    target: topRepoRoot,
  };

  const blocked = protectedBaseWriteBlock(singleRepoOptions, { requireBootstrap: false });
  if (blocked) {
    runDoctorInSandbox(singleRepoOptions, blocked);
    return;
  }

  assertProtectedMainWriteAllowed(singleRepoOptions, 'doctor');
  const fixPayload = runFixInternal(singleRepoOptions);
  const scanResult = runScanInternal({ target: singleRepoOptions.target, json: false });
  const currentBaseBranch = currentBranchName(scanResult.repoRoot);
  const autoFinishSummary = scanResult.guardexEnabled === false
    ? {
      enabled: false,
      attempted: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      details: [],
    }
    : autoFinishReadyAgentBranches(scanResult.repoRoot, {
      baseBranch: currentBaseBranch,
      dryRun: singleRepoOptions.dryRun,
      waitForMerge: singleRepoOptions.waitForMerge,
    });
  const safe = scanResult.guardexEnabled === false || (scanResult.errors === 0 && scanResult.warnings === 0);
  const musafe = safe;

  if (singleRepoOptions.json) {
    process.stdout.write(
      JSON.stringify(
        {
          repoRoot: scanResult.repoRoot,
          branch: scanResult.branch,
          safe,
          musafe,
          fix: {
            operations: fixPayload.operations,
            hookResult: fixPayload.hookResult,
            dryRun: Boolean(singleRepoOptions.dryRun),
          },
          scan: {
            guardexEnabled: scanResult.guardexEnabled !== false,
            guardexToggle: scanResult.guardexToggle || null,
            errors: scanResult.errors,
            warnings: scanResult.warnings,
            findings: scanResult.findings,
          },
          autoFinish: autoFinishSummary,
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
  if (scanResult.guardexEnabled === false) {
    console.log(`[${TOOL_NAME}] Repo-local Guardex enforcement is intentionally disabled.`);
    setExitCodeFromScan(scanResult);
    return;
  }
  printAutoFinishSummary(autoFinishSummary, {
    baseBranch: currentBaseBranch,
    verbose: singleRepoOptions.verboseAutoFinish,
  });
  if (safe) {
    console.log(colorizeDoctorOutput(`[${TOOL_NAME}] ✅ Repo is fully safe.`, 'safe'));
  } else {
    console.log(
      colorizeDoctorOutput(
        `[${TOOL_NAME}] ⚠️ Repo is not fully safe yet (${scanResult.errors} error(s), ${scanResult.warnings} warning(s)).`,
        scanResult.errors > 0 ? 'unsafe' : 'warn',
      ),
    );
  }
  setExitCodeFromScan(scanResult);
}

function review(rawArgs) {
  const options = parseReviewArgs(rawArgs);
  const repoRoot = resolveRepoRoot(options.target);
  const result = runReviewBotCommand(repoRoot, options.passthroughArgs);
  if (isSpawnFailure(result)) {
    throw result.error;
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

function agentsStatePathForRepo(repoRoot) {
  return path.join(repoRoot, AGENTS_BOTS_STATE_RELATIVE);
}

function readAgentsState(repoRoot) {
  const statePath = agentsStatePathForRepo(repoRoot);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function writeAgentsState(repoRoot, state) {
  const statePath = agentsStatePathForRepo(repoRoot);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function processAlive(pid) {
  const normalizedPid = Number.parseInt(String(pid || ''), 10);
  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) {
    return false;
  }
  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function sleepSeconds(seconds) {
  const result = run('sleep', [String(seconds)]);
  if (isSpawnFailure(result) || result.status !== 0) {
    throw new Error(`sleep command failed for ${seconds}s`);
  }
}

function readProcessCommand(pid) {
  const result = run('ps', ['-o', 'command=', '-p', String(pid)]);
  if (isSpawnFailure(result) || result.status !== 0) {
    return '';
  }
  return String(result.stdout || '').trim();
}

function stopAgentProcessByPid(pid, expectedToken = '') {
  const normalizedPid = Number.parseInt(String(pid || ''), 10);
  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) {
    return { status: 'invalid', pid: normalizedPid };
  }
  if (!processAlive(normalizedPid)) {
    return { status: 'not-running', pid: normalizedPid };
  }

  if (expectedToken) {
    const cmdline = readProcessCommand(normalizedPid);
    if (cmdline && !cmdline.includes(expectedToken)) {
      return { status: 'mismatch', pid: normalizedPid, command: cmdline };
    }
  }

  try {
    process.kill(-normalizedPid, 'SIGTERM');
  } catch (_error) {
    try {
      process.kill(normalizedPid, 'SIGTERM');
    } catch (_err) {
      return { status: 'term-failed', pid: normalizedPid };
    }
  }

  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if (!processAlive(normalizedPid)) {
      return { status: 'stopped', pid: normalizedPid };
    }
    sleepSeconds(0.1);
  }

  try {
    process.kill(-normalizedPid, 'SIGKILL');
  } catch (_error) {
    try {
      process.kill(normalizedPid, 'SIGKILL');
    } catch (_err) {
      return { status: 'kill-failed', pid: normalizedPid };
    }
  }
  sleepSeconds(0.1);

  return {
    status: processAlive(normalizedPid) ? 'kill-failed' : 'stopped',
    pid: normalizedPid,
  };
}

function spawnDetachedAgentProcess({ command, args, cwd, logPath }) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logHandle = fs.openSync(logPath, 'a');
  fs.writeSync(
    logHandle,
    `[${new Date().toISOString()}] spawn: ${command} ${args.join(' ')}\n`,
  );
  const child = cp.spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', logHandle, logHandle],
    env: process.env,
  });
  fs.closeSync(logHandle);
  if (child.error) {
    throw child.error;
  }
  child.unref();
  const pid = Number.parseInt(String(child.pid || ''), 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Failed to spawn detached process for ${command}`);
  }
  return pid;
}

function agents(rawArgs) {
  const options = parseAgentsArgs(rawArgs);
  const repoRoot = resolveRepoRoot(options.target);
  const statePath = agentsStatePathForRepo(repoRoot);

  if (options.subcommand === 'start') {
    const existingState = readAgentsState(repoRoot);
    const existingReviewPid = Number.parseInt(String(existingState?.review?.pid || ''), 10);
    const existingCleanupPid = Number.parseInt(String(existingState?.cleanup?.pid || ''), 10);
    const reviewRunning = processAlive(existingReviewPid);
    const cleanupRunning = processAlive(existingCleanupPid);

    if (reviewRunning && cleanupRunning) {
      console.log(
        `[${TOOL_NAME}] Repo agents already running (review pid=${existingReviewPid}, cleanup pid=${existingCleanupPid}).`,
      );
      process.exitCode = 0;
      return;
    }

    const reviewLogPath = path.join(repoRoot, '.omx', 'logs', 'agent-review.log');
    const cleanupLogPath = path.join(repoRoot, '.omx', 'logs', 'agent-cleanup.log');

    let reviewPid = existingReviewPid;
    let cleanupPid = existingCleanupPid;
    let startedAny = false;
    let reusedAny = false;

    if (!reviewRunning) {
      reviewPid = spawnDetachedAgentProcess({
        command: process.execPath,
        args: [
          path.resolve(__filename),
          'internal',
          'run-shell',
          'reviewBot',
          '--target',
          repoRoot,
          '--interval',
          String(options.reviewIntervalSeconds),
        ],
        cwd: repoRoot,
        logPath: reviewLogPath,
      });
      startedAny = true;
    } else {
      reusedAny = true;
    }

    if (!cleanupRunning) {
      cleanupPid = spawnDetachedAgentProcess({
        command: process.execPath,
        args: [
          path.resolve(__filename),
          'cleanup',
          '--target',
          repoRoot,
          '--watch',
          '--interval',
          String(options.cleanupIntervalSeconds),
          '--idle-minutes',
          String(options.idleMinutes),
        ],
        cwd: repoRoot,
        logPath: cleanupLogPath,
      });
      startedAny = true;
    } else {
      reusedAny = true;
    }

    const priorReviewInterval = Number.parseInt(String(existingState?.review?.intervalSeconds || ''), 10);
    const priorCleanupInterval = Number.parseInt(String(existingState?.cleanup?.intervalSeconds || ''), 10);
    const priorIdleMinutes = Number.parseInt(String(existingState?.cleanup?.idleMinutes || ''), 10);
    const reviewIntervalSeconds = reviewRunning && Number.isInteger(priorReviewInterval) && priorReviewInterval >= 5
      ? priorReviewInterval
      : options.reviewIntervalSeconds;
    const cleanupIntervalSeconds = cleanupRunning && Number.isInteger(priorCleanupInterval) && priorCleanupInterval >= 5
      ? priorCleanupInterval
      : options.cleanupIntervalSeconds;
    const idleMinutes = cleanupRunning && Number.isInteger(priorIdleMinutes) && priorIdleMinutes >= 1
      ? priorIdleMinutes
      : options.idleMinutes;

    writeAgentsState(repoRoot, {
      schemaVersion: 1,
      repoRoot,
      startedAt: new Date().toISOString(),
      review: {
        pid: reviewPid,
        intervalSeconds: reviewIntervalSeconds,
        script: path.resolve(__filename),
        logPath: reviewLogPath,
      },
      cleanup: {
        pid: cleanupPid,
        intervalSeconds: cleanupIntervalSeconds,
        idleMinutes,
        script: path.resolve(__filename),
        logPath: cleanupLogPath,
      },
    });

    console.log(
      `[${TOOL_NAME}] Started repo agents in ${repoRoot} (review pid=${reviewPid}, cleanup pid=${cleanupPid}).`,
    );
    if (reusedAny && startedAny) {
      console.log(`[${TOOL_NAME}] Reused healthy bot process(es) and started only missing ones.`);
    }
    console.log(`[${TOOL_NAME}] Logs: ${reviewLogPath}, ${cleanupLogPath}`);
    process.exitCode = 0;
    return;
  }

  if (options.subcommand === 'stop') {
    const existingState = readAgentsState(repoRoot);
    if (!existingState) {
      console.log(`[${TOOL_NAME}] Repo agents are not running for ${repoRoot}.`);
      process.exitCode = 0;
      return;
    }

    const reviewStop = stopAgentProcessByPid(existingState?.review?.pid, 'internal run-shell reviewBot');
    const cleanupStop = stopAgentProcessByPid(existingState?.cleanup?.pid, `${path.basename(__filename)} cleanup`);

    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }

    console.log(
      `[${TOOL_NAME}] Stopped repo agents in ${repoRoot} (review=${reviewStop.status}, cleanup=${cleanupStop.status}).`,
    );
    process.exitCode = 0;
    return;
  }

  const existingState = readAgentsState(repoRoot);
  if (!existingState) {
    console.log(`[${TOOL_NAME}] Repo agents status: inactive (${repoRoot})`);
    process.exitCode = 0;
    return;
  }

  const reviewPid = Number.parseInt(String(existingState?.review?.pid || ''), 10);
  const cleanupPid = Number.parseInt(String(existingState?.cleanup?.pid || ''), 10);
  console.log(
    `[${TOOL_NAME}] Repo agents status: review=${processAlive(reviewPid) ? 'running' : 'stopped'}(pid=${reviewPid || 0}), cleanup=${processAlive(cleanupPid) ? 'running' : 'stopped'}(pid=${cleanupPid || 0})`,
  );
  process.exitCode = 0;
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
  const options = parseSetupArgs(rawArgs, {
    target: process.cwd(),
    force: false,
    skipAgents: false,
    skipPackageJson: false,
    skipGitignore: false,
    dryRun: false,
    yesGlobalInstall: false,
    noGlobalInstall: false,
    allowProtectedBaseWrite: false,
  });

  const globalInstallStatus = installGlobalToolchain(options);
  if (globalInstallStatus.status === 'installed') {
    console.log(
      `[${TOOL_NAME}] ✅ Companion tools installed (${(globalInstallStatus.packages || []).join(', ')}).`,
    );
  } else if (globalInstallStatus.status === 'already-installed') {
    console.log(`[${TOOL_NAME}] ✅ Companion tools already installed. Skipping.`);
  } else if (globalInstallStatus.status === 'failed') {
    const installCommands = describeCompanionInstallCommands(
      GLOBAL_TOOLCHAIN_PACKAGES,
      OPTIONAL_LOCAL_COMPANION_TOOLS,
    );
    console.log(
      `[${TOOL_NAME}] ⚠️ Global install failed: ${globalInstallStatus.reason}\n` +
      `[${TOOL_NAME}] Continue with local safety setup. You can retry later with:\n` +
      installCommands.map((command) => `  ${command}`).join('\n'),
    );
  } else if (globalInstallStatus.status === 'skipped' && globalInstallStatus.reason === 'non-interactive-default') {
    console.log(
      `[${TOOL_NAME}] Skipping companion installs (non-interactive mode). ` +
      `Use --yes-global-install to force or run interactively for Y/N prompt.`,
    );
  } else if (globalInstallStatus.status === 'skipped') {
    console.log(`[${TOOL_NAME}] ⚠️ Companion installs skipped by user choice.`);
    for (const warning of describeMissingGlobalDependencyWarnings(
      globalInstallStatus.missingPackages || [],
    )) {
      console.log(`[${TOOL_NAME}] ⚠️ ${warning}`);
    }
  }
  const requiredSystemTools = detectRequiredSystemTools();
  const missingSystemTools = requiredSystemTools.filter((tool) => tool.status !== 'active');
  if (missingSystemTools.length === 0) {
    console.log(`[${TOOL_NAME}] ✅ Required system tools available (${requiredSystemTools.map((tool) => tool.name).join(', ')}).`);
  } else {
    const names = missingSystemTools.map((tool) => tool.name).join(', ');
    console.log(`[${TOOL_NAME}] ⚠️ Missing required system tool(s): ${names}`);
    for (const tool of missingSystemTools) {
      const reasonText = tool.reason ? ` (${tool.reason})` : '';
      console.log(`[${TOOL_NAME}] Install ${tool.name}: ${tool.installHint}${reasonText}`);
    }
  }

  const topRepoRoot = resolveRepoRoot(options.target);
  const discoveredRepos = options.recursive
    ? discoverNestedGitRepos(topRepoRoot, {
        maxDepth: options.nestedMaxDepth,
        extraSkip: options.nestedSkipDirs,
        includeSubmodules: options.includeSubmodules,
        skipRelativeDirs: AGENT_WORKTREE_RELATIVE_DIRS,
      })
    : [topRepoRoot];

  if (discoveredRepos.length > 1) {
    console.log(
      `[${TOOL_NAME}] Detected ${discoveredRepos.length} git repos under ${topRepoRoot}. Installing into each (use --no-recursive or --current to limit to the top-level).`,
    );
    for (const repoPath of discoveredRepos) {
      const marker = repoPath === topRepoRoot ? ' (top-level)' : '';
      console.log(`[${TOOL_NAME}]   - ${repoPath}${marker}`);
    }
  }

  let aggregateErrors = 0;
  let aggregateWarnings = 0;
  let lastScanResult = null;

  for (const repoPath of discoveredRepos) {
    const perRepoOptions = { ...options, target: repoPath };
    const repoLabel = discoveredRepos.length > 1 ? ` [${path.relative(topRepoRoot, repoPath) || '.'}]` : '';

    if (discoveredRepos.length > 1) {
      console.log(`[${TOOL_NAME}] ── Setup target: ${repoPath} ──`);
    }

    const blocked = protectedBaseWriteBlock(perRepoOptions);
    if (blocked) {
      const sandboxResult = runSetupInSandbox(perRepoOptions, blocked, repoLabel);
      aggregateErrors += sandboxResult.scanResult.errors;
      aggregateWarnings += sandboxResult.scanResult.warnings;
      lastScanResult = sandboxResult.scanResult;
      continue;
    }

    const { installPayload, fixPayload, parentWorkspace } = runSetupBootstrapInternal(perRepoOptions);
    printOperations(`Setup/install${repoLabel}`, installPayload, perRepoOptions.dryRun);
    printOperations(`Setup/fix${repoLabel}`, fixPayload, perRepoOptions.dryRun);

    if (perRepoOptions.dryRun) {
      continue;
    }

    if (parentWorkspace) {
      console.log(`[${TOOL_NAME}] Parent workspace view: ${parentWorkspace.workspacePath}`);
    }

    const scanResult = runScanInternal({ target: repoPath, json: false });
    const currentBaseBranch = currentBranchName(scanResult.repoRoot);
    const autoFinishSummary = autoFinishReadyAgentBranches(scanResult.repoRoot, {
      baseBranch: currentBaseBranch,
      dryRun: perRepoOptions.dryRun,
    });
    printScanResult(scanResult, false);
    if (autoFinishSummary.enabled) {
      console.log(
        `[${TOOL_NAME}] Auto-finish sweep (base=${currentBaseBranch}): attempted=${autoFinishSummary.attempted}, completed=${autoFinishSummary.completed}, skipped=${autoFinishSummary.skipped}, failed=${autoFinishSummary.failed}`,
      );
      for (const detail of autoFinishSummary.details) {
        console.log(`[${TOOL_NAME}]   ${detail}`);
      }
    } else if (autoFinishSummary.details.length > 0) {
      console.log(`[${TOOL_NAME}] ${autoFinishSummary.details[0]}`);
    }
    printSetupRepoHints(scanResult.repoRoot, currentBaseBranch, repoLabel);

    aggregateErrors += scanResult.errors;
    aggregateWarnings += scanResult.warnings;
    lastScanResult = scanResult;
  }

  if (options.dryRun) {
    console.log(`[${TOOL_NAME}] Dry run setup done.`);
    process.exitCode = 0;
    return;
  }

  if (aggregateErrors === 0 && aggregateWarnings === 0) {
    const repoCount = discoveredRepos.length;
    const suffix = repoCount > 1 ? ` (${repoCount} repos)` : '';
    console.log(`[${TOOL_NAME}] ✅ Setup complete.${suffix}`);
    console.log(`[${TOOL_NAME}] Copy AI setup prompt with: ${SHORT_TOOL_NAME} prompt`);
    console.log(
      `[${TOOL_NAME}] OpenSpec core workflow: /opsx:propose -> /opsx:apply -> /opsx:archive`,
    );
    console.log(
      `[${TOOL_NAME}] Optional expanded OpenSpec profile: openspec config profile <profile-name> && openspec update`,
    );
    console.log(`[${TOOL_NAME}] OpenSpec guide: docs/openspec-getting-started.md`);
  }

  if (lastScanResult) {
    setExitCodeFromScan({
      ...lastScanResult,
      errors: aggregateErrors,
      warnings: aggregateWarnings,
    });
  }
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

function readReleaseRepoPackageJson(repoRoot) {
  const manifestPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Release blocked: package.json missing in ${repoRoot}`);
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Release blocked: unable to parse package.json in ${repoRoot}: ${error.message}`);
  }
}

function resolveReleaseGithubRepo(repoRoot) {
  const releasePackageJson = readReleaseRepoPackageJson(repoRoot);
  const fromManifest = inferGithubRepoSlug(
    releasePackageJson.repository &&
      (releasePackageJson.repository.url || releasePackageJson.repository),
  );
  if (fromManifest) {
    return fromManifest;
  }

  const fromOrigin = inferGithubRepoSlug(readGitConfig(repoRoot, 'remote.origin.url'));
  if (fromOrigin) {
    return fromOrigin;
  }

  throw new Error(
    'Release blocked: unable to resolve GitHub repo from package.json repository URL or origin remote.',
  );
}

function readRepoReadme(repoRoot) {
  const readmePath = path.join(repoRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    throw new Error(`Release blocked: README.md missing in ${repoRoot}`);
  }
  return fs.readFileSync(readmePath, 'utf8');
}

function parseReadmeReleaseEntries(readmeContent) {
  const releaseNotesIndex = String(readmeContent || '').indexOf('## Release notes');
  if (releaseNotesIndex < 0) {
    throw new Error('Release blocked: README.md is missing the "## Release notes" section');
  }

  const releaseNotesContent = String(readmeContent || '').slice(releaseNotesIndex);
  const entries = [];
  const lines = releaseNotesContent.split(/\r?\n/);
  let currentTag = '';
  let currentLines = [];

  function flushEntry() {
    if (!currentTag) {
      return;
    }
    const body = currentLines.join('\n').trim();
    if (body) {
      entries.push({ tag: currentTag, body, version: parseVersionString(currentTag) });
    }
    currentTag = '';
    currentLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(v\d+\.\d+\.\d+)\s*$/);
    if (headingMatch) {
      flushEntry();
      currentTag = headingMatch[1];
      continue;
    }

    if (!currentTag) {
      continue;
    }

    if (/^<\/details>\s*$/.test(line) || /^##\s+/.test(line)) {
      flushEntry();
      continue;
    }

    currentLines.push(line);
  }

  flushEntry();

  if (entries.length === 0) {
    throw new Error('Release blocked: README.md did not yield any versioned release-note sections');
  }

  return entries;
}

function resolvePreviousPublishedReleaseTag(repoSlug, currentTag) {
  const result = run(GH_BIN, ['release', 'list', '--repo', repoSlug, '--limit', '20'], {
    timeout: 20_000,
  });
  if (result.error) {
    throw new Error(`Release blocked: unable to run '${GH_BIN} release list': ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(`Release blocked: unable to list GitHub releases.${details ? `\n${details}` : ''}`);
  }

  const tags = String(result.stdout || '')
    .split('\n')
    .map((line) => line.split('\t')[0].trim())
    .filter(Boolean);

  return tags.find((tag) => tag !== currentTag) || '';
}

function selectReleaseEntriesForWindow(entries, currentTag, previousTag) {
  const currentVersion = parseVersionString(currentTag);
  if (!currentVersion) {
    throw new Error(`Release blocked: invalid current version tag '${currentTag}'`);
  }
  const previousVersion = previousTag ? parseVersionString(previousTag) : null;

  const selected = entries.filter((entry) => {
    if (!entry.version) return false;
    if (compareParsedVersions(entry.version, currentVersion) > 0) return false;
    if (!previousVersion) return entry.tag === currentTag;
    return compareParsedVersions(entry.version, previousVersion) > 0;
  });

  if (!selected.some((entry) => entry.tag === currentTag)) {
    throw new Error(`Release blocked: README.md is missing release notes for ${currentTag}`);
  }

  return selected;
}

function renderGeneratedReleaseNotes(entries, currentTag, previousTag) {
  const intro = previousTag ? `Changes since ${previousTag}.` : `Changes in ${currentTag}.`;
  const sections = entries
    .map((entry) => `### ${entry.tag}\n${entry.body}`)
    .join('\n\n');
  return `GitGuardex ${currentTag}\n\n${intro}\n\n${sections}`;
}

function buildReleaseNotesFromReadme(repoRoot, currentTag, previousTag) {
  const readme = readRepoReadme(repoRoot);
  const entries = parseReadmeReleaseEntries(readme);
  const selected = selectReleaseEntriesForWindow(entries, currentTag, previousTag);
  return renderGeneratedReleaseNotes(selected, currentTag, previousTag);
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

  if (!isCommandAvailable(GH_BIN)) {
    throw new Error(`Release blocked: '${GH_BIN}' is not available`);
  }

  const ghAuthStatus = run(GH_BIN, ['auth', 'status'], { timeout: 20_000 });
  if (ghAuthStatus.error) {
    throw new Error(`Release blocked: unable to run '${GH_BIN} auth status': ${ghAuthStatus.error.message}`);
  }
  if (ghAuthStatus.status !== 0) {
    const details = (ghAuthStatus.stderr || ghAuthStatus.stdout || '').trim();
    throw new Error(`Release blocked: '${GH_BIN}' auth is unavailable.${details ? `\n${details}` : ''}`);
  }

  const releasePackageJson = readReleaseRepoPackageJson(repoRoot);
  const repoSlug = resolveReleaseGithubRepo(repoRoot);
  const currentTag = `v${releasePackageJson.version}`;
  const previousTag = resolvePreviousPublishedReleaseTag(repoSlug, currentTag);
  const notes = buildReleaseNotesFromReadme(repoRoot, currentTag, previousTag);
  const headCommit = gitRun(repoRoot, ['rev-parse', 'HEAD']).stdout.trim();

  const existingRelease = run(GH_BIN, ['release', 'view', currentTag, '--repo', repoSlug], {
    timeout: 20_000,
  });
  if (existingRelease.error) {
    throw new Error(`Release blocked: unable to run '${GH_BIN} release view': ${existingRelease.error.message}`);
  }

  const releaseArgs =
    existingRelease.status === 0
      ? ['release', 'edit', currentTag, '--repo', repoSlug, '--title', currentTag, '--notes', notes]
      : [
          'release',
          'create',
          currentTag,
          '--repo',
          repoSlug,
          '--target',
          headCommit,
          '--title',
          currentTag,
          '--notes',
          notes,
        ];

  console.log(
    `[${TOOL_NAME}] ${existingRelease.status === 0 ? 'Updating' : 'Creating'} GitHub release ${currentTag} on ${repoSlug}`,
  );
  if (previousTag) {
    console.log(`[${TOOL_NAME}] Aggregating README release notes newer than ${previousTag}.`);
  } else {
    console.log(`[${TOOL_NAME}] No earlier published GitHub release found; using only ${currentTag}.`);
  }

  const releaseResult = run(GH_BIN, releaseArgs, { cwd: repoRoot, timeout: 60_000 });
  if (releaseResult.error) {
    throw new Error(`Release blocked: unable to run '${GH_BIN} release': ${releaseResult.error.message}`);
  }
  if (releaseResult.status !== 0) {
    const details = (releaseResult.stderr || releaseResult.stdout || '').trim();
    throw new Error(`GitHub release command failed.${details ? `\n${details}` : ''}`);
  }

  const releaseUrl = String(releaseResult.stdout || '').trim();
  if (releaseUrl) {
    console.log(releaseUrl);
  }

  console.log(`[${TOOL_NAME}] ✅ GitHub release ${currentTag} is synced to the README history.`);
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

function prompt(rawArgs) {
  const args = Array.isArray(rawArgs) ? rawArgs : [];
  let variant = 'prompt';
  for (const arg of args) {
    if (arg === '--exec' || arg === '--commands') variant = 'exec';
    else if (arg === '--snippet' || arg === '--agents') variant = 'snippet';
    else if (arg === '--prompt' || arg === '--full') variant = 'prompt';
    else if (arg === '-h' || arg === '--help') variant = 'help';
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (variant === 'help') {
    console.log(
      `${SHORT_TOOL_NAME} prompt commands:\n` +
      `  ${SHORT_TOOL_NAME} prompt           Print AI setup checklist\n` +
      `  ${SHORT_TOOL_NAME} prompt --exec    Print setup commands only (shell-ready)\n` +
      `  ${SHORT_TOOL_NAME} prompt --snippet Print the AGENTS.md managed-block template`,
    );
    process.exitCode = 0;
    return;
  }
  if (variant === 'exec') return copyCommands();
  if (variant === 'snippet') return printAgentsSnippet();
  return copyPrompt();
}

function branch(rawArgs) {
  const [subcommand, ...rest] = rawArgs;
  if (subcommand === 'start') {
    const { target, passthrough } = extractTargetedArgs(rest);
    invokePackageAsset('branchStart', passthrough, { cwd: resolveRepoRoot(target) });
    return;
  }
  if (subcommand === 'finish') {
    const { target, passthrough } = extractTargetedArgs(rest);
    invokePackageAsset('branchFinish', passthrough, { cwd: resolveRepoRoot(target) });
    return;
  }
  if (subcommand === 'merge') return merge(rest);
  throw new Error(
    `Usage: ${SHORT_TOOL_NAME} branch <start|finish|merge> [options] ` +
    `(examples: '${SHORT_TOOL_NAME} branch start "<task>" "<agent>"', '${SHORT_TOOL_NAME} branch finish --branch <agent/...>')`,
  );
}

function locks(rawArgs) {
  const { target, passthrough } = extractTargetedArgs(rawArgs);
  const result = runPackageAsset('lockTool', passthrough, { cwd: resolveRepoRoot(target) });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.status;
}

function worktree(rawArgs) {
  const [subcommand, ...rest] = rawArgs;
  if (subcommand === 'prune') {
    const { target, passthrough } = extractTargetedArgs(rest);
    invokePackageAsset('worktreePrune', passthrough, { cwd: resolveRepoRoot(target) });
    return;
  }
  throw new Error(`Usage: ${SHORT_TOOL_NAME} worktree prune [cleanup-options]`);
}

function hook(rawArgs) {
  return hooksModule.hook(rawArgs, {
    extractTargetedArgs,
    run,
    resolveRepoRoot,
    packageAssetEnv,
    configureHooks,
    TEMPLATE_ROOT,
    HOOK_NAMES,
    TOOL_NAME,
    SHORT_TOOL_NAME,
  });
}

function internal(rawArgs) {
  return hooksModule.internal(rawArgs, {
    extractTargetedArgs,
    resolveRepoRoot,
    runReviewBotCommand,
    runPackageAsset,
  });
}

function installAgentSkills(rawArgs) {
  let dryRun = false;
  let force = false;
  for (const arg of rawArgs) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  const operations = USER_LEVEL_SKILL_ASSETS.map((asset) => installUserLevelAsset(asset, { dryRun, force }));
  printStandaloneOperations('User-level Guardex skills', GUARDEX_HOME_DIR, operations, dryRun);
  process.exitCode = 0;
}

function migrate(rawArgs) {
  const { target, passthrough } = extractTargetedArgs(rawArgs);
  let dryRun = false;
  let force = false;
  let installSkills = false;
  for (const arg of passthrough) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--install-agent-skills') {
      installSkills = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  const repoRoot = resolveRepoRoot(target);
  const fixPayload = runFixInternal({
    target: repoRoot,
    dryRun,
    force,
    skipAgents: false,
    skipPackageJson: true,
    skipGitignore: false,
    dropStaleLocks: true,
  });
  printOperations('Migrate/fix', fixPayload, dryRun);

  if (installSkills) {
    const skillOps = USER_LEVEL_SKILL_ASSETS.map((asset) => installUserLevelAsset(asset, { dryRun, force }));
    printStandaloneOperations('Migrate/install-agent-skills', GUARDEX_HOME_DIR, skillOps, dryRun);
  }

  const removableLegacyFiles = LEGACY_MANAGED_REPO_FILES.filter(
    (relativePath) => !REQUIRED_MANAGED_REPO_FILES.includes(relativePath),
  );
  const removalOps = removableLegacyFiles.map((relativePath) => removeLegacyManagedRepoFile(repoRoot, relativePath, { dryRun, force }));
  removalOps.push(removeLegacyPackageScripts(repoRoot, dryRun));
  printStandaloneOperations('Migrate/cleanup', repoRoot, removalOps, dryRun);
  process.exitCode = 0;
}

function cleanup(rawArgs) {
  return getFinishApi().cleanup(rawArgs);
}

function merge(rawArgs) {
  return getFinishApi().merge(rawArgs);
}

function finish(rawArgs, defaults = {}) {
  return getFinishApi().finish(rawArgs, defaults);
}

function sync(rawArgs) {
  return getFinishApi().sync(rawArgs);
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

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    maybeSelfUpdateBeforeStatus();
    maybeOpenSpecUpdateBeforeStatus();
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
    maybeSelfUpdateBeforeStatus();
    console.log(packageJson.version);
    return;
  }

  // Deprecated direct aliases — route to new surface and warn once.
  if (DEPRECATED_COMMAND_ALIASES.has(command)) {
    warnDeprecatedAlias(command);
    if (command === 'init') return setup(rest);
    if (command === 'install') return install(rest);
    if (command === 'fix') return fix(rest);
    if (command === 'scan') return scan(rest);
    if (command === 'copy-prompt') return copyPrompt();
    if (command === 'copy-commands') return copyCommands();
    if (command === 'print-agents-snippet') return printAgentsSnippet();
    if (command === 'review') return review(rest);
  }

  if (command === 'status') {
    const { found: strict, remaining } = extractFlag(rest, '--strict');
    if (strict) return scan(remaining);
    return status(remaining);
  }

  if (command === 'setup') {
    const installOnly = extractFlag(rest, '--install-only', '--only-install');
    if (installOnly.found) return install(installOnly.remaining);
    const repairOnly = extractFlag(installOnly.remaining, '--repair', '--fix-only');
    if (repairOnly.found) return fix(repairOnly.remaining);
    return setup(repairOnly.remaining);
  }

  if (command === 'prompt') return prompt(rest);
  if (command === 'doctor') return doctor(rest);
  if (command === 'branch') return branch(rest);
  if (command === 'locks') return locks(rest);
  if (command === 'worktree') return worktree(rest);
  if (command === 'hook') return hook(rest);
  if (command === 'migrate') return migrate(rest);
  if (command === 'install-agent-skills') return installAgentSkills(rest);
  if (command === 'internal') return internal(rest);
  if (command === 'agents') return agents(rest);
  if (command === 'merge') return merge(rest);
  if (command === 'finish') return finish(rest);
  if (command === 'report') return report(rest);
  if (command === 'protect') return protect(rest);
  if (command === 'sync') return sync(rest);
  if (command === 'cleanup') return cleanup(rest);
  if (command === 'release') return release(rest);

  const suggestion = maybeSuggestCommand(command);
  if (suggestion) {
    throw new Error(`Unknown command: ${command}. Did you mean '${suggestion}'?`);
  }
  throw new Error(`Unknown command: ${command}`);
}

function runFromBin() {
  try {
    main();
  } catch (error) {
    console.error(`[${TOOL_NAME}] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runFromBin();
}

module.exports = {
  main,
  runFromBin,
};
