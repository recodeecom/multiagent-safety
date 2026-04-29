const { readCockpitState } = require('./state');
const { renderCockpit } = require('./render');
const {
  ensureTmuxAvailable,
  sessionExists,
  createSession,
  attachSession,
  sendKeys,
} = require('../tmux/session');

const DEFAULT_SESSION_NAME = 'guardex';

function parseCockpitArgs(rawArgs = []) {
  const options = {
    sessionName: DEFAULT_SESSION_NAME,
    attach: false,
    target: process.cwd(),
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--attach') {
      options.attach = true;
      continue;
    }
    if (arg === '--session') {
      const next = rawArgs[index + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('--session requires a tmux session name');
      }
      options.sessionName = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--session=')) {
      options.sessionName = arg.slice('--session='.length);
      if (!options.sessionName) {
        throw new Error('--session requires a tmux session name');
      }
      continue;
    }
    if (arg === '--target' || arg === '-t') {
      const next = rawArgs[index + 1];
      if (!next || next.startsWith('-')) {
        throw new Error(`${arg} requires a repo path`);
      }
      options.target = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown cockpit option: ${arg}`);
  }

  return options;
}

function render(repoPath = process.cwd()) {
  return renderCockpit(readCockpitState(repoPath));
}

function startCockpit(options = {}) {
  const repoPath = options.repoPath || process.cwd();
  const refreshMs = Number.isFinite(options.refreshMs) && options.refreshMs > 0
    ? options.refreshMs
    : 2000;

  const paint = () => {
    process.stdout.write('\x1Bc');
    process.stdout.write(render(repoPath));
  };

  paint();
  return setInterval(paint, refreshMs);
}

function openCockpit(rawArgs, deps = {}) {
  const {
    resolveRepoRoot,
    toolName = 'gitguardex',
    stdout = process.stdout,
    tmux = {
      ensureTmuxAvailable,
      sessionExists,
      createSession,
      attachSession,
      sendKeys,
    },
  } = deps;
  if (typeof resolveRepoRoot !== 'function') {
    throw new Error('openCockpit requires resolveRepoRoot');
  }

  const options = parseCockpitArgs(rawArgs);
  const repoRoot = resolveRepoRoot(options.target);
  const controlCommand = 'gx agents status';

  tmux.ensureTmuxAvailable();

  if (tmux.sessionExists(options.sessionName)) {
    stdout.write(`[${toolName}] Attaching tmux session '${options.sessionName}'.\n`);
    tmux.attachSession(options.sessionName);
    return { action: 'attached', sessionName: options.sessionName, repoRoot };
  }

  const createResult = tmux.createSession(options.sessionName, repoRoot);
  if (createResult.error) throw createResult.error;
  if (createResult.status !== 0) {
    const detail = String(createResult.stderr || createResult.stdout || '').trim();
    throw new Error(`tmux could not create session '${options.sessionName}'${detail ? `: ${detail}` : '.'}`);
  }
  const sendResult = tmux.sendKeys(options.sessionName, controlCommand);
  if (sendResult.error) throw sendResult.error;
  if (sendResult.status !== 0) {
    const detail = String(sendResult.stderr || sendResult.stdout || '').trim();
    throw new Error(`tmux could not start cockpit control pane${detail ? `: ${detail}` : '.'}`);
  }
  stdout.write(`[${toolName}] Created tmux session '${options.sessionName}' in ${repoRoot}.\n`);
  stdout.write(`[${toolName}] Control pane: gx agents status\n`);

  if (options.attach) {
    tmux.attachSession(options.sessionName);
    return { action: 'created-attached', sessionName: options.sessionName, repoRoot };
  }

  return { action: 'created', sessionName: options.sessionName, repoRoot };
}

if (require.main === module) {
  startCockpit({
    repoPath: process.argv[2] || process.cwd(),
    refreshMs: Number.parseInt(process.env.GUARDEX_COCKPIT_REFRESH_MS || '2000', 10),
  });
}

module.exports = {
  DEFAULT_SESSION_NAME,
  parseCockpitArgs,
  openCockpit,
  render,
  startCockpit,
};
