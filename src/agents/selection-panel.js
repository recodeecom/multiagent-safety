'use strict';

const {
  getAgentDefinitions,
  resolveAgent,
} = require('./registry');

const DEFAULT_MAX_SELECTED_AGENTS = 10;

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
  if (key === 'enter') {
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

function renderAgentSelectionPanel(options = {}) {
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
    '↑/↓ navigate · Space toggle · +/- Codex accounts · Enter launch · ESC cancel',
  ].filter((row) => row !== null);
  return `${framePanel('Select Agent(s)', rows)}\n`;
}

function renderInteractiveAgentSelectionPanel(state = {}) {
  return renderAgentSelectionPanel({
    task: state.task,
    base: state.base,
    claims: state.claims,
    maxSelected: state.maxSelected,
    selections: selectionsFromPanelState(state),
    focusedAgentId: focusedAgent(state)?.id,
    message: state.message,
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
