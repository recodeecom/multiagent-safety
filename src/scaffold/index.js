const {
  fs,
  path,
  TOOL_NAME,
  SHORT_TOOL_NAME,
  toDestinationPath,
  EXECUTABLE_RELATIVE_PATHS,
  CRITICAL_GUARDRAIL_PATHS,
} = require('../context');

function ensureParentDir(repoRoot, filePath, dryRun) {
  if (dryRun) return;

  const parentDir = path.dirname(filePath);
  const relativeParentDir = path.relative(repoRoot, parentDir);
  const segments = relativeParentDir.split(path.sep).filter(Boolean);
  let currentPath = repoRoot;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    if (fs.existsSync(currentPath) && !fs.statSync(currentPath).isDirectory()) {
      const blockingPath = path.relative(repoRoot, currentPath) || path.basename(currentPath);
      const targetPath = path.relative(repoRoot, filePath) || path.basename(filePath);
      throw new Error(
        `Path conflict: ${blockingPath} exists as a file, but ${targetPath} needs it to be a directory. ` +
        `Remove or rename ${blockingPath} and rerun '${SHORT_TOOL_NAME} setup'.`,
      );
    }
  }

  fs.mkdirSync(parentDir, { recursive: true });
}

function ensureExecutable(destinationPath, relativePath, dryRun) {
  if (dryRun) return;
  if (EXECUTABLE_RELATIVE_PATHS.has(relativePath)) {
    fs.chmodSync(destinationPath, 0o755);
  }
}

function isCriticalGuardrailPath(relativePath) {
  return CRITICAL_GUARDRAIL_PATHS.has(relativePath);
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function renderShellDispatchShim(commandParts) {
  const rendered = commandParts.map((part) => shellSingleQuote(part)).join(' ');
  return (
    '#!/usr/bin/env bash\n' +
    'set -euo pipefail\n' +
    '\n' +
    'if [[ -n "${GUARDEX_CLI_ENTRY:-}" ]]; then\n' +
    '  node_bin="${GUARDEX_NODE_BIN:-node}"\n' +
    `  exec "$node_bin" "$GUARDEX_CLI_ENTRY" ${rendered} "$@"\n` +
    'fi\n' +
    '\n' +
    'resolve_guardex_cli() {\n' +
    '  if [[ -n "${GUARDEX_CLI_BIN:-}" ]]; then\n' +
    '    printf \'%s\' "$GUARDEX_CLI_BIN"\n' +
    '    return 0\n' +
    '  fi\n' +
    '  if command -v gx >/dev/null 2>&1; then\n' +
    '    printf \'%s\' "gx"\n' +
    '    return 0\n' +
    '  fi\n' +
    '  if command -v gitguardex >/dev/null 2>&1; then\n' +
    '    printf \'%s\' "gitguardex"\n' +
    '    return 0\n' +
    '  fi\n' +
    '  echo "[gitguardex-shim] Missing gx CLI in PATH." >&2\n' +
    '  exit 1\n' +
    '}\n' +
    '\n' +
    'cli_bin="$(resolve_guardex_cli)"\n' +
    `exec "$cli_bin" ${rendered} "$@"\n`
  );
}

function renderPythonDispatchShim(commandParts) {
  return (
    '#!/usr/bin/env python3\n' +
    'import os\n' +
    'import shutil\n' +
    'import subprocess\n' +
    'import sys\n' +
    '\n' +
    `COMMAND = ${JSON.stringify(commandParts)}\n` +
    '\n' +
    'entry = os.environ.get("GUARDEX_CLI_ENTRY")\n' +
    'if entry:\n' +
    '    node_bin = os.environ.get("GUARDEX_NODE_BIN") or shutil.which("node") or "node"\n' +
    '    raise SystemExit(subprocess.call([node_bin, entry, *COMMAND, *sys.argv[1:]]))\n' +
    'cli = os.environ.get("GUARDEX_CLI_BIN") or shutil.which("gx") or shutil.which("gitguardex")\n' +
    'if not cli:\n' +
    '    sys.stderr.write("[gitguardex-shim] Missing gx CLI in PATH.\\n")\n' +
    '    raise SystemExit(1)\n' +
    'raise SystemExit(subprocess.call([cli, *COMMAND, *sys.argv[1:]]))\n'
  );
}

function managedForceConflictMessage(relativePath) {
  return (
    `Refusing to overwrite existing file without --force: ${relativePath}\n` +
    `Use '--force ${relativePath}' to rewrite only this managed file, or '--force' to rewrite all managed files.`
  );
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

function printStandaloneOperations(title, rootLabel, operations, dryRun = false) {
  console.log(`[${TOOL_NAME}] ${title}: ${rootLabel}`);
  for (const operation of operations) {
    const note = operation.note ? ` (${operation.note})` : '';
    console.log(`  - ${operation.status.padEnd(12)} ${operation.file}${note}`);
  }
  if (dryRun) {
    console.log(`[${TOOL_NAME}] Dry run complete. No files were modified.`);
  }
}

module.exports = {
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
};
