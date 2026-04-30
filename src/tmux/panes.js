const tmux = require('./command');

const PANE_FIELD_SEPARATOR = '\x1f';
const PANE_FORMAT = [
  '#{pane_id}',
  '#{session_name}',
  '#{window_index}',
  '#{pane_index}',
  '#{pane_title}',
  '#{pane_current_command}',
  '#{pane_active}',
].join(PANE_FIELD_SEPARATOR);

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function addCwd(args, cwd) {
  if (cwd !== undefined) {
    args.push('-c', requireText(cwd, 'tmux cwd'));
  }
}

function addCommand(args, command) {
  if (command !== undefined) {
    args.push(requireCommand(command));
  }
}

function requireCommand(command) {
  if (typeof command !== 'string') {
    throw new TypeError('tmux command must be a string');
  }
  return command;
}

function requirePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return String(parsed);
}

function parsePane(line) {
  const [
    paneId,
    sessionName,
    windowIndex,
    paneIndex,
    title,
    currentCommand,
    active,
  ] = line.split(PANE_FIELD_SEPARATOR);

  return {
    id: paneId,
    sessionName,
    windowIndex: Number.parseInt(windowIndex, 10),
    paneIndex: Number.parseInt(paneIndex, 10),
    title,
    currentCommand,
    active: active === '1',
  };
}

function listPanes(sessionName) {
  const result = tmux.runTmux(
    ['list-panes', '-s', '-t', requireText(sessionName, 'tmux session name'), '-F', PANE_FORMAT],
    { stdio: 'pipe' },
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }
  return result.stdout.trim().split('\n').map(parsePane);
}

function splitPane(targetPane, options = {}) {
  const direction = options.direction || options.split || 'vertical';
  const args = ['split-window'];

  if (direction === 'horizontal') {
    args.push('-h');
  } else if (direction === 'vertical') {
    args.push('-v');
  } else {
    throw new TypeError('tmux split direction must be horizontal or vertical');
  }

  args.push('-t', requireText(targetPane, 'tmux pane target'));

  if (options.detached === true) {
    args.push('-d');
  }
  if (options.size !== undefined) {
    args.push('-l', requirePositiveInteger(options.size, 'tmux split size'));
  }
  addCwd(args, options.cwd);
  addCommand(args, options.command);
  return tmux.runTmux(args);
}

function selectLayout(sessionName, layoutName) {
  return tmux.runTmux([
    'select-layout',
    '-t',
    requireText(sessionName, 'tmux session name'),
    requireText(layoutName, 'tmux layout name'),
  ]);
}

function resizePane(targetPane, options = {}) {
  const args = ['resize-pane', '-t', requireText(targetPane, 'tmux pane target')];
  const directionFlags = {
    left: '-L',
    right: '-R',
    up: '-U',
    down: '-D',
  };

  if (options.direction !== undefined) {
    const flag = directionFlags[options.direction];
    if (!flag) {
      throw new TypeError('tmux resize direction must be left, right, up, or down');
    }
    args.push(flag);
    if (options.cells !== undefined) {
      args.push(requirePositiveInteger(options.cells, 'tmux resize cells'));
    }
  }

  if (options.width !== undefined) {
    args.push('-x', requirePositiveInteger(options.width, 'tmux pane width'));
  }
  if (options.height !== undefined) {
    args.push('-y', requirePositiveInteger(options.height, 'tmux pane height'));
  }

  if (args.length === 3) {
    throw new TypeError('tmux resize requires direction, width, or height');
  }

  return tmux.runTmux(args);
}

function sendCommand(targetPane, command) {
  return tmux.runTmux([
    'send-keys',
    '-t',
    requireText(targetPane, 'tmux pane target'),
    requireCommand(command),
    'C-m',
  ]);
}

function killPane(targetPane) {
  return tmux.runTmux(['kill-pane', '-t', requireText(targetPane, 'tmux pane target')]);
}

function setPaneTitle(targetPane, title) {
  return tmux.runTmux([
    'select-pane',
    '-t',
    requireText(targetPane, 'tmux pane target'),
    '-T',
    requireText(title, 'tmux pane title'),
  ]);
}

module.exports = {
  listPanes,
  splitPane,
  selectLayout,
  resizePane,
  sendCommand,
  killPane,
  setPaneTitle,
};
