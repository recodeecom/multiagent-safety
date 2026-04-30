'use strict';

const {
  getAgentDefinitions,
  resolveAgent,
} = require('./registry');

const DEFAULT_MAX_SELECTED_AGENTS = 10;
const DEFAULT_PANEL_WIDTH = 118;
const DEFAULT_PANEL_HEIGHT = 30;
const SIDEBAR_WIDTH = 36;

const ANSI = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  brightBlue: '\x1b[94m',
  cyan: '\x1b[36m',
  inverse: '\x1b[7m',
};

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flagName} requires a positive integer`);
  }
  return parsed;
}

function parseAgentSelectionToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) return null;
  const match = token.match(/^([^:=\s]+)(?::|=)?(\d+)?$/);
  if (!match) {
    throw new Error(`Invalid agent selection: ${token}`);
  }
  return {
    id: match[1],
    count: match[2] ? parsePositiveInteger(match[2], '--agents') : 1,
  };
}

function parseAgentSelectionSpec(rawSpec) {
  return String(rawSpec || '')
    .split(',')
    .map(parseAgentSelectionToken)
    .filter(Boolean);
}

function normalizeAgentSelections(options = {}) {
  const maxSelected = options.maxSelected || DEFAULT_MAX_SELECTED_AGENTS;
  const merged = new Map();
  const addSelection = (selection) => {
    const agent = resolveAgent(selection.id);
    const existing = merged.get(agent.id) || { agent, count: 0 };
    existing.count += selection.count;
    merged.set(agent.id, existing);
  };

  const specs = Array.isArray(options.agentSelectionSpecs) ? options.agentSelectionSpecs : [];
  if (specs.length > 0) {
    specs.flatMap(parseAgentSelectionSpec).forEach(addSelection);
  } else {
    addSelection({
      id: options.agent || 'codex',
      count: options.count || 1,
    });
  }

  const selections = [...merged.values()];
  const total = selectedAgentCount(selections);
  if (total > maxSelected) {
    throw new Error(`Selected agent count ${total} exceeds the maximum ${maxSelected}`);
  }
  return selections;
}

function selectedAgentCount(selections) {
  return selections.reduce((sum, selection) => sum + selection.count, 0);
}

function countForAgent(selections, agentId) {
  const selection = selections.find((candidate) => candidate.agent.id === agentId);
  return selection ? selection.count : 0;
}

function countsFromSelections(selections) {
  const counts = {};
  for (const selection of selections) {
    counts[selection.agent.id] = selection.count;
  }
  return counts;
}

function clampIndex(index, length) {
  if (length <= 0) return 0;
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function createAgentSelectionPanelState(options = {}) {
  const definitions = getAgentDefinitions();
  const maxSelected = options.maxSelected || DEFAULT_MAX_SELECTED_AGENTS;
  const selections = normalizeAgentSelections({ ...options, maxSelected });
  const counts = countsFromSelections(selections);
  const firstSelectedIndex = definitions.findIndex((agent) => (counts[agent.id] || 0) > 0);
  return {
    task: options.task || '',
    base: options.base || '',
    claims: Array.isArray(options.claims) ? [...options.claims] : [],
    maxSelected,
    focusIndex: firstSelectedIndex >= 0 ? firstSelectedIndex : 0,
    counts,
    message: '',
  };
}

function selectionsFromPanelState(state = {}) {
  const counts = state.counts || {};
  return getAgentDefinitions()
    .map((agent) => ({
      agent,
      count: Number.isInteger(counts[agent.id]) ? counts[agent.id] : 0,
    }))
    .filter((selection) => selection.count > 0);
}

function selectedCountFromPanelState(state = {}) {
  return selectedAgentCount(selectionsFromPanelState(state));
}

function focusedAgent(state = {}) {
  const definitions = getAgentDefinitions();
  return definitions[clampIndex(state.focusIndex, definitions.length)] || definitions[0];
}

function withCount(state, agentId, count, message = '') {
  return {
    ...state,
    counts: {
      ...(state.counts || {}),
      [agentId]: Math.max(0, count),
    },
    message,
  };
}

function normalizePanelKey(value) {
  if (!value) return '';
  const raw = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  if (raw === '\u0003') return 'ctrl-c';
  if (raw === '\u001b') return 'escape';
  if (raw === '\r' || raw === '\n') return 'enter';
  if (raw === '\u001b[A') return 'up';
  if (raw === '\u001b[B') return 'down';
  return raw.toLowerCase();
}

function applyAgentSelectionKey(state = {}, rawKey) {
  const definitions = getAgentDefinitions();
  const current = {
    ...state,
    focusIndex: clampIndex(state.focusIndex, definitions.length),
    counts: { ...(state.counts || {}) },
    message: '',
  };
  const key = normalizePanelKey(rawKey);

  if (key === 'ctrl-c' || key === 'escape' || key === 'q') {
    return { state: current, action: 'cancel' };
  }
  if (key === 'enter' || key === 'n') {
    if (selectedCountFromPanelState(current) <= 0) {
      return { state: { ...current, message: 'Select at least one agent before launch.' }, action: 'render' };
    }
    return { state: current, action: 'launch' };
  }
  if (key === 'up' || key === 'k') {
    return {
      state: {
        ...current,
        focusIndex: (current.focusIndex - 1 + definitions.length) % definitions.length,
      },
      action: 'render',
    };
  }
  if (key === 'down' || key === 'j') {
    return {
      state: {
        ...current,
        focusIndex: (current.focusIndex + 1) % definitions.length,
      },
      action: 'render',
    };
  }

  const codexCount = current.counts.codex || 0;
  const selectedCount = selectedCountFromPanelState(current);
  if (key === '+') {
    if (selectedCount >= current.maxSelected) {
      return { state: { ...current, message: `Selected agent count cannot exceed ${current.maxSelected}.` }, action: 'render' };
    }
    return { state: withCount(current, 'codex', codexCount + 1), action: 'render' };
  }
  if (key === '-') {
    return { state: withCount(current, 'codex', Math.max(0, codexCount - 1)), action: 'render' };
  }
  if (key === ' ' || key === 'space') {
    const agent = focusedAgent(current);
    const nextCount = current.counts[agent.id] > 0 ? 0 : 1;
    if (nextCount > 0 && selectedCount >= current.maxSelected) {
      return { state: { ...current, message: `Selected agent count cannot exceed ${current.maxSelected}.` }, action: 'render' };
    }
    return { state: withCount(current, agent.id, nextCount), action: 'render' };
  }

  return { state: current, action: 'render' };
}

function padLine(value, width) {
  const text = String(value || '');
  if (text.length >= width) return text.slice(0, width);
  return `${text}${' '.repeat(width - text.length)}`;
}

function centerLine(value, width) {
  const text = String(value || '');
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return `${' '.repeat(left)}${text}${' '.repeat(width - text.length - left)}`;
}

function colorize(value, color, options = {}) {
  if (!options.color) return value;
  const code = ANSI[color];
  return code ? `${code}${value}${ANSI.reset}` : value;
}

function panelWidth(options = {}) {
  const width = Number(options.width);
  if (!Number.isFinite(width)) return DEFAULT_PANEL_WIDTH;
  return Math.max(80, Math.floor(width));
}

function panelHeight(options = {}) {
  const height = Number(options.height);
  if (!Number.isFinite(height)) return DEFAULT_PANEL_HEIGHT;
  return Math.max(24, Math.floor(height) - 1);
}

function framePanel(title, rows, width = 92) {
  const safeWidth = Math.max(40, width);
  const titleText = ` ${title} `;
  const topFill = Math.max(0, safeWidth - titleText.length - 2);
  const top = `┌${titleText}${'─'.repeat(topFill)}┐`;
  const bottom = `└${'─'.repeat(safeWidth - 2)}┘`;
  return [
    top,
    ...rows.map((row) => `│${padLine(` ${row}`, safeWidth - 2)}│`),
    bottom,
  ].join('\n');
}

function matrixChar(row, column, seed) {
  const value = (row * 17 + column * 31 + seed * 13 + row * column) % 41;
  if (value === 0 || value === 7) return '1';
  if (value === 3 || value === 11) return '0';
  return '.';
}

function renderMatrixLine(width, row, seed) {
  let line = '';
  for (let column = 0; column < width; column += 1) {
    line += matrixChar(row, column, seed);
  }
  return line;
}

function overlay(line, segment, column) {
  const start = Math.max(0, Math.min(column, line.length));
  const text = String(segment || '').slice(0, Math.max(0, line.length - start));
  return `${line.slice(0, start)}${text}${line.slice(start + text.length)}`;
}

function renderSidebarRows(options, selections, definitions, width, height) {
  const total = selectedAgentCount(selections);
  const maxSelected = options.maxSelected || DEFAULT_MAX_SELECTED_AGENTS;
  const codexAccounts = countForAgent(selections, 'codex');
  const claims = Array.isArray(options.claims) && options.claims.length > 0
    ? options.claims.join(', ')
    : 'none';
  const topBars = '█'.repeat(Math.max(0, width - 13));
  const rows = [
    `─ gx ${'─'.repeat(Math.max(0, width - 5))}`,
    `▦ gitguardex ${topBars}`.slice(0, width),
    '  [n]ew agent  [t]erminal',
    '',
    '  Select Agent(s)',
    `  Selected: ${total}/${maxSelected}`,
    '',
    ...definitions.map((agent) => {
      const count = countForAgent(selections, agent.id);
      const marker = count > 0 ? '●' : '○';
      const suffix = count > 1 ? ` x${count}` : '';
      const focus = options.focusedAgentId === agent.id ? '› ' : '  ';
      return `${focus}${marker} ${agent.label} ${agent.shortLabel.toLowerCase()}${suffix}`;
    }),
    '',
    '  Settings',
    `  task: ${options.task || '-'}`,
    `  base: ${options.base || 'current branch'}`,
    `  Codex accounts: ${codexAccounts}`,
    `  claims: ${claims}`,
    options.message ? `  status: ${options.message}` : '',
  ];

  while (rows.length < height - 5) {
    rows.push('');
  }

  rows.push(
    '─'.repeat(width),
    '  [l]ogs  •  [p]rojects',
    '  Press [?] for keyboard shortcuts',
    '  Tip: Hidden panes keep running.',
    '',
  );

  return rows.slice(0, height).map((row) => padLine(row, width));
}

function renderLogoCardRows(options, selections, width) {
  const total = selectedAgentCount(selections);
  const maxSelected = options.maxSelected || DEFAULT_MAX_SELECTED_AGENTS;
  const innerWidth = Math.max(46, width - 2);
  const logoRows = [
    ' ██████╗ ██╗  ██╗',
    '██╔════╝ ╚██╗██╔╝',
    '██║  ███╗ ╚███╔╝ ',
    '██║   ██║ ██╔██╗ ',
    '╚██████╔╝██╔╝ ██╗',
    ' ╚═════╝ ╚═╝  ╚═╝',
  ];
  const body = [
    ...logoRows.map((line) => centerLine(line, innerWidth)),
    centerLine('gitguardex', innerWidth),
    centerLine('AI developer agent guardrail multiplexer', innerWidth),
    centerLine(`Select Agent(s) · Selected: ${total}/${maxSelected}`, innerWidth),
    centerLine('Press [n] or Enter to create a new agent', innerWidth),
  ];

  return [
    `┌${'─'.repeat(innerWidth)}┐`,
    ...body.map((row) => `│${row}│`),
    `└${'─'.repeat(innerWidth)}┘`,
  ];
}

function renderMainRows(options, selections, width, height) {
  const seed = String(options.task || 'gitguardex')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const title = ' Welcome ';
  const rows = [
    `─${title}${'─'.repeat(Math.max(0, width - title.length - 1))}`,
  ];

  for (let row = 1; row < height - 1; row += 1) {
    rows.push(renderMatrixLine(width, row, seed));
  }
  rows.push('─'.repeat(width));

  const cardWidth = Math.min(Math.max(56, Math.floor(width * 0.45)), width - 6);
  const cardRows = renderLogoCardRows(options, selections, cardWidth);
  const top = Math.max(2, Math.floor((height - cardRows.length) / 2));
  const left = Math.max(2, Math.floor((width - cardWidth) / 2));
  cardRows.forEach((cardRow, offset) => {
    const target = top + offset;
    if (target >= 0 && target < rows.length) {
      rows[target] = overlay(rows[target], cardRow, left);
    }
  });

  return rows.map((row) => padLine(row, width));
}

function renderDmuxAgentSelectionPanel(options = {}) {
  const definitions = getAgentDefinitions();
  const maxSelected = options.maxSelected || DEFAULT_MAX_SELECTED_AGENTS;
  const selections = options.selections || normalizeAgentSelections({ ...options, maxSelected });
  const width = panelWidth(options);
  const height = panelHeight(options);
  const sidebarWidth = Math.min(SIDEBAR_WIDTH, Math.max(28, Math.floor(width * 0.38)));
  const mainWidth = Math.max(42, width - sidebarWidth - 1);
  const sidebar = renderSidebarRows({ ...options, maxSelected }, selections, definitions, sidebarWidth, height);
  const main = renderMainRows({ ...options, maxSelected }, selections, mainWidth, height);
  const keyLine = padLine(' ↑/↓ navigate · Space toggle · +/- Codex accounts · [n]/Enter launch · ESC cancel ', width);
  const lines = [];

  for (let index = 0; index < height; index += 1) {
    const left = colorize(sidebar[index] || ''.padEnd(sidebarWidth, ' '), 'cyan', options);
    const divider = colorize('│', 'blue', options);
    const right = colorize(main[index] || ''.padEnd(mainWidth, ' '), 'brightBlue', options);
    lines.push(`${left}${divider}${right}`);
  }

  lines.push(colorize(keyLine, 'inverse', options));
  return `${lines.join('\n')}\n`;
}

function renderAgentSelectionPanel(options = {}) {
  if (!options.compact) {
    return renderDmuxAgentSelectionPanel(options);
  }

  const definitions = getAgentDefinitions();
  const maxSelected = options.maxSelected || DEFAULT_MAX_SELECTED_AGENTS;
  const selections = options.selections || normalizeAgentSelections({ ...options, maxSelected });
  const total = selectedAgentCount(selections);
  const claims = Array.isArray(options.claims) && options.claims.length > 0
    ? options.claims.join(', ')
    : 'none';
  const codexAccounts = countForAgent(selections, 'codex');
  const rows = [
    `Select one or more agents, then launch. Selected: ${total}/${maxSelected}`,
    '',
    ...definitions.map((agent) => {
      const count = countForAgent(selections, agent.id);
      const marker = count > 0 ? '●' : '○';
      const suffix = count > 1 ? ` x${count}` : '';
      const focus = options.focusedAgentId === agent.id ? '› ' : '';
      return `${focus}${marker} ${agent.label} ${agent.shortLabel.toLowerCase()}${suffix}`;
    }),
    '',
    'Settings',
    `task: ${options.task || '-'}`,
    `base: ${options.base || 'current branch'}`,
    `Codex accounts: ${codexAccounts}`,
    `claims: ${claims}`,
    options.message ? `status: ${options.message}` : null,
    '',
    '↑/↓ navigate · Space toggle · +/- Codex accounts · [n]/Enter launch · ESC cancel',
  ].filter((row) => row !== null);
  return `${framePanel('Select Agent(s)', rows)}\n`;
}

function renderInteractiveAgentSelectionPanel(state = {}, options = {}) {
  return renderAgentSelectionPanel({
    task: state.task,
    base: state.base,
    claims: state.claims,
    maxSelected: state.maxSelected,
    selections: selectionsFromPanelState(state),
    focusedAgentId: focusedAgent(state)?.id,
    message: state.message,
    ...options,
  });
}

module.exports = {
  applyAgentSelectionKey,
  createAgentSelectionPanelState,
  DEFAULT_MAX_SELECTED_AGENTS,
  countForAgent,
  framePanel,
  normalizeAgentSelections,
  parseAgentSelectionSpec,
  renderInteractiveAgentSelectionPanel,
  renderAgentSelectionPanel,
  selectionsFromPanelState,
  selectedAgentCount,
};
