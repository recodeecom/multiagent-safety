#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function resolveExtensionSource(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'vscode', 'guardex-active-agents'),
    path.join(repoRoot, 'templates', 'vscode', 'guardex-active-agents'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  throw new Error('Could not find the Guardex VS Code companion sources.');
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const options = parseOptions(process.argv.slice(2));
  const sourceDir = resolveExtensionSource(repoRoot);
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf8'));
  const extensionId = `${manifest.publisher}.${manifest.name}`;
  const extensionsDir = path.resolve(
    options['extensions-dir'] ||
      process.env.GUARDEX_VSCODE_EXTENSIONS_DIR ||
      process.env.VSCODE_EXTENSIONS_DIR ||
      path.join(os.homedir(), '.vscode', 'extensions'),
  );

  fs.mkdirSync(extensionsDir, { recursive: true });
  const targetDir = path.join(extensionsDir, `${extensionId}-${manifest.version}`);

  for (const entry of fs.readdirSync(extensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === path.basename(targetDir)) {
      continue;
    }
    if (entry.name.startsWith(`${extensionId}-`)) {
      removeIfExists(path.join(extensionsDir, entry.name));
    }
  }

  removeIfExists(targetDir);
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
  });

  process.stdout.write(
    `[guardex-active-agents] Installed ${extensionId}@${manifest.version} to ${targetDir}\n` +
      '[guardex-active-agents] Reload the VS Code window to activate the Source Control companion.\n',
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`[guardex-active-agents] ${error.message}\n`);
  process.exitCode = 1;
}
