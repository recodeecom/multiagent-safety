const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  applyAgentSelectionKey,
  countForAgent,
  createAgentSelectionPanelState,
  normalizeAgentSelections,
  parseAgentSelectionSpec,
  renderInteractiveAgentSelectionPanel,
  renderAgentSelectionPanel,
  selectionsFromPanelState,
  selectedAgentCount,
} = require('../src/agents/selection-panel');

test('parseAgentSelectionSpec accepts repeated agent counts', () => {
  assert.deepEqual(parseAgentSelectionSpec('codex:3,claude,gemini=2'), [
    { id: 'codex', count: 3 },
    { id: 'claude', count: 1 },
    { id: 'gemini', count: 2 },
  ]);
});

test('normalizeAgentSelections merges repeated agents and enforces the max', () => {
  const selections = normalizeAgentSelections({
    agentSelectionSpecs: ['codex:2,claude', 'codex'],
  });

  assert.equal(selectedAgentCount(selections), 4);
  assert.equal(countForAgent(selections, 'codex'), 3);
  assert.equal(countForAgent(selections, 'claude'), 1);
  assert.throws(
    () => normalizeAgentSelections({ agentSelectionSpecs: ['codex:11'] }),
    /Selected agent count 11 exceeds the maximum 10/,
  );
});

test('renderAgentSelectionPanel shows selected count and codex account setting', () => {
  const output = renderAgentSelectionPanel({
    task: 'repair auth',
    base: 'main',
    claims: ['src/auth.js'],
    agentSelectionSpecs: ['codex:3'],
  });

  assert.match(output, /Select Agent\(s\)/);
  assert.match(output, /Selected: 3\/10/);
  assert.match(output, /● Codex cx x3/);
  assert.match(output, /Codex accounts: 3/);
  assert.match(output, /task: repair auth/);
  assert.match(output, /base: main/);
  assert.match(output, /claims: src\/auth\.js/);
});

test('interactive panel keys move focus, toggle agents, and adjust codex accounts', () => {
  let state = createAgentSelectionPanelState({
    task: 'repair auth',
    base: 'main',
    agentSelectionSpecs: ['codex:2'],
  });

  assert.equal(selectedAgentCount(selectionsFromPanelState(state)), 2);
  assert.match(renderInteractiveAgentSelectionPanel(state), /› ● Codex cx x2/);

  state = applyAgentSelectionKey(state, '\u001b[B').state;
  assert.match(renderInteractiveAgentSelectionPanel(state), /› ○ Claude Code cc/);

  state = applyAgentSelectionKey(state, ' ').state;
  assert.equal(countForAgent(selectionsFromPanelState(state), 'claude'), 1);

  state = applyAgentSelectionKey(state, '+').state;
  assert.equal(countForAgent(selectionsFromPanelState(state), 'codex'), 3);

  state = applyAgentSelectionKey(state, '-').state;
  assert.equal(countForAgent(selectionsFromPanelState(state), 'codex'), 2);
  assert.equal(applyAgentSelectionKey(state, '\r').action, 'launch');
  assert.equal(applyAgentSelectionKey(state, '\u001b').action, 'cancel');
});
