const DEFAULT_SESSION_NAME = 'guardex';
const DEFAULT_SIDEBAR_WIDTH = 34;
const DEFAULT_TERMINAL_COLUMNS = 120;
const DEFAULT_TERMINAL_ROWS = 40;
const MIN_CONTENT_COLUMNS = 20;

function text(value, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sidebarWidthFor(value, terminalColumns) {
  const requested = positiveInteger(value, DEFAULT_SIDEBAR_WIDTH);
  if (terminalColumns <= MIN_CONTENT_COLUMNS) {
    return Math.max(1, terminalColumns - 1);
  }
  return Math.min(requested, terminalColumns - MIN_CONTENT_COLUMNS);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function normalizeSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((session, index) => ({
    sessionId: text(session.sessionId || session.id, `session-${index + 1}`),
    branch: text(session.branch),
    worktreePath: text(session.worktreePath),
    command: text(session.command),
  }));
}

function paneTarget(sessionName, paneIndex) {
  return `${sessionName}:0.${paneIndex}`;
}

function windowTarget(sessionName) {
  return `${sessionName}:0`;
}

function agentGrid(count) {
  if (count <= 1) return { columns: 1, rows: 1 };
  const columns = Math.ceil(Math.sqrt(count));
  return {
    columns,
    rows: Math.ceil(count / columns),
  };
}

function dimension(total, parts, index) {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return base + (index < remainder ? 1 : 0);
}

function offset(total, parts, index) {
  let value = 0;
  for (let part = 0; part < index; part += 1) {
    value += dimension(total, parts, part);
  }
  return value;
}

function agentGeometry(index, count, sidebarWidth, terminalColumns, terminalRows) {
  const mainColumns = Math.max(1, terminalColumns - sidebarWidth);
  const grid = agentGrid(count);
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return {
    x: sidebarWidth + offset(mainColumns, grid.columns, column),
    y: offset(terminalRows, grid.rows, row),
    width: dimension(mainColumns, grid.columns, column),
    height: dimension(terminalRows, grid.rows, row),
  };
}

function sidebarPane(sessionName, sidebarWidth, terminalRows, command) {
  return {
    role: 'sidebar',
    target: paneTarget(sessionName, 0),
    width: sidebarWidth,
    height: terminalRows,
    command,
  };
}

function agentCommand(session) {
  if (session.command) return session.command;
  if (!session.worktreePath) return 'gx agents status';
  return `cd ${shellQuote(session.worktreePath)} && exec ${'${SHELL:-bash}'}`;
}

function agentPane(sessionName, session, index, count, selectedSessionId, sidebarWidth, terminalColumns, terminalRows) {
  return {
    role: 'agent',
    target: paneTarget(sessionName, index + 1),
    sessionId: session.sessionId,
    branch: session.branch,
    worktreePath: session.worktreePath,
    selected: session.sessionId === selectedSessionId,
    command: agentCommand(session),
    ...agentGeometry(index, count, sidebarWidth, terminalColumns, terminalRows),
  };
}

function detailsPane(sessionName, paneIndex, sidebarWidth, terminalColumns, terminalRows, command) {
  return {
    role: 'details',
    target: paneTarget(sessionName, paneIndex),
    x: sidebarWidth,
    y: 0,
    width: Math.max(1, terminalColumns - sidebarWidth),
    height: terminalRows,
    command,
  };
}

function sendKeysCommand(role, target, command) {
  return {
    role,
    args: ['send-keys', '-t', target, command, 'C-m'],
  };
}

function buildTmuxCommands(plan) {
  const commands = [
    {
      role: 'session',
      args: ['new-session', '-d', '-s', plan.sessionName],
    },
    sendKeysCommand('sidebar', plan.panes[0].target, plan.panes[0].command),
  ];

  const contentPanes = plan.panes.filter((pane) => pane.role !== 'sidebar');
  if (contentPanes.length > 0) {
    commands.push({
      role: 'content',
      args: ['split-window', '-h', '-t', plan.panes[0].target],
    });
    commands.push({
      role: 'sidebar',
      args: ['resize-pane', '-t', plan.panes[0].target, '-x', String(plan.sidebarWidth)],
    });
  }

  for (let index = 1; index < contentPanes.length; index += 1) {
    commands.push({
      role: contentPanes[index].role,
      args: ['split-window', index % 2 === 1 ? '-h' : '-v', '-t', contentPanes[index - 1].target],
    });
  }

  if (contentPanes.filter((pane) => pane.role === 'agent').length > 1) {
    commands.push({
      role: 'layout',
      args: ['select-layout', '-t', windowTarget(plan.sessionName), 'tiled'],
    });
    commands.push({
      role: 'sidebar',
      args: ['resize-pane', '-t', plan.panes[0].target, '-x', String(plan.sidebarWidth)],
    });
  }

  for (const pane of contentPanes) {
    commands.push(sendKeysCommand(pane.role, pane.target, pane.command));
  }

  return commands;
}

function planCockpitLayout(options = {}) {
  const sessions = normalizeSessions(options.sessions);
  const terminalColumns = positiveInteger(options.terminalColumns, DEFAULT_TERMINAL_COLUMNS);
  const terminalRows = positiveInteger(options.terminalRows, DEFAULT_TERMINAL_ROWS);
  const sessionName = text(options.sessionName, DEFAULT_SESSION_NAME);
  const sidebarWidth = sidebarWidthFor(options.sidebarWidth, terminalColumns);
  const sidebarCommand = text(options.sidebarCommand, 'gx agents status');
  const selectedSessionId = text(options.selectedSessionId);
  const panes = [
    sidebarPane(sessionName, sidebarWidth, terminalRows, sidebarCommand),
  ];

  if (sessions.length === 0) {
    panes.push(detailsPane(sessionName, 1, sidebarWidth, terminalColumns, terminalRows, 'gx agents status'));
  } else {
    sessions.forEach((session, index) => {
      panes.push(agentPane(
        sessionName,
        session,
        index,
        sessions.length,
        selectedSessionId,
        sidebarWidth,
        terminalColumns,
        terminalRows,
      ));
    });
  }

  const plan = {
    sessionName,
    terminalColumns,
    terminalRows,
    sidebarWidth,
    panes,
  };
  return {
    ...plan,
    tmuxCommands: buildTmuxCommands(plan),
  };
}

module.exports = {
  DEFAULT_SESSION_NAME,
  DEFAULT_SIDEBAR_WIDTH,
  planCockpitLayout,
};
