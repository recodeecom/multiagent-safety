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

test('renderAgentSelectionPanel shows a dmux-style GitGuardex shell', () => {
  const output = renderAgentSelectionPanel({
    task: 'repair auth',
    base: 'main',
    claims: ['src/auth.js'],
    agentSelectionSpecs: ['codex:3'],
  });

  assert.match(output, /Select Agent\(s\)/);
  assert.match(output, /Welcome/);
  assert.match(output, /Pane Management/);
  assert.match(output, /gitguardex/);
  assert.match(output, /\[n\] launch/);
  assert.match(output, /\[t\] terminal/);
  assert.match(output, /multi-agent terminals: Kitty/);
  assert.match(output, /Alt\+Shift\+M/);
  assert.match(output, /Files/);
  assert.match(output, /Selected: 3\/10/);
  assert.match(output, /● Codex cx x3/);
  assert.match(output, /Codex accounts: 3/);
  assert.match(output, /task: repair auth/);
  assert.match(output, /base: main/);
  assert.match(output, /claims: src\/auth\.js/);

  const blueOutput = renderAgentSelectionPanel({
    task: 'repair auth',
    agentSelectionSpecs: ['codex:1'],
    color: true,
  });
  assert.match(blueOutput, /\x1b\[36m/);
  assert.match(blueOutput, /\x1b\[94m/);
});

test('empty interactive panel captures a task before launch', () => {
  let state = createAgentSelectionPanelState({
    task: '',
    base: 'main',
    agentSelectionSpecs: ['codex'],
  });

  assert.equal(state.taskInputActive, true);
  assert.match(renderInteractiveAgentSelectionPanel(state), /type a task to start/);
  assert.match(renderInteractiveAgentSelectionPanel(state), /Type task text directly/);
  assert.match(renderInteractiveAgentSelectionPanel(state), /task: _/);

  let help = applyAgentSelectionKey(state, '?');
  assert.equal(help.action, 'render');
  assert.equal(help.state.task, '');
  assert.match(help.state.message, /Shortcut map is shown on the right/);

  let next = applyAgentSelectionKey(state, 'n');
  assert.equal(next.action, 'render');
  assert.equal(next.state.task, 'n');
  state = next.state;

  state = applyAgentSelectionKey(state, 'e').state;
  state = applyAgentSelectionKey(state, 'q').state;
  state = applyAgentSelectionKey(state, '\u007f').state;
  state = applyAgentSelectionKey(state, 'w').state;
  assert.equal(state.task, 'new');

  next = applyAgentSelectionKey(state, '\r');
  assert.equal(next.action, 'launch');
  assert.equal(next.state.task, 'new');
  assert.equal(next.state.taskInputActive, false);
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
  const terminalHelp = applyAgentSelectionKey(state, 't');
  assert.equal(terminalHelp.action, 'render');
  assert.match(terminalHelp.state.message, /Kitty agent terminals open after multi-agent launch/);
  const paneMenuHelp = applyAgentSelectionKey(state, '\u001bM');
  assert.equal(paneMenuHelp.action, 'render');
  assert.match(paneMenuHelp.state.message, /selected pane/);
  assert.equal(applyAgentSelectionKey(state, 'n').action, 'launch');
  assert.equal(applyAgentSelectionKey(state, '\r').action, 'launch');
  assert.equal(applyAgentSelectionKey(state, '\u001b').action, 'cancel');
});
