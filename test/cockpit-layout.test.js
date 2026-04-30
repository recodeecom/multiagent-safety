const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_SIDEBAR_WIDTH,
  planCockpitLayout,
} = require('../src/cockpit/layout');

function session(id) {
  return {
    sessionId: id,
    branch: `agent/codex/${id}`,
    worktreePath: `/repo/.omx/agent-worktrees/${id}`,
  };
}

test('plans sidebar and welcome details pane for zero sessions', () => {
  const plan = planCockpitLayout({
    sessions: [],
    terminalColumns: 120,
    terminalRows: 40,
  });

  assert.deepEqual(
    plan.panes.map((pane) => pane.role),
    ['sidebar', 'details'],
  );
  assert.equal(plan.sessionName, 'guardex');
  assert.equal(plan.sidebarWidth, DEFAULT_SIDEBAR_WIDTH);
  assert.deepEqual(plan.panes[0], {
    role: 'sidebar',
    target: 'guardex:0.0',
    width: 34,
    height: 40,
    command: 'gx agents status',
  });
  assert.equal(plan.panes[1].target, 'guardex:0.1');
  assert.equal(plan.panes[1].width, 86);
  assert.equal(plan.panes[1].command, 'gx agents status');
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
});

test('plans sidebar and one agent pane with configurable sidebar width', () => {
  const plan = planCockpitLayout({
    sessionName: 'guardex-dev',
    sessions: [session('alpha')],
    selectedSessionId: 'alpha',
    sidebarWidth: 40,
    terminalColumns: 140,
    terminalRows: 36,
  });

  assert.deepEqual(
    plan.panes.map((pane) => pane.role),
    ['sidebar', 'agent'],
  );
  assert.equal(plan.sidebarWidth, 40);
  assert.equal(plan.panes[1].target, 'guardex-dev:0.1');
  assert.equal(plan.panes[1].sessionId, 'alpha');
  assert.equal(plan.panes[1].branch, 'agent/codex/alpha');
  assert.equal(plan.panes[1].worktreePath, '/repo/.omx/agent-worktrees/alpha');
  assert.equal(plan.panes[1].selected, true);
  assert.equal(plan.panes[1].width, 100);
  assert.equal(plan.panes[1].height, 36);
  assert.equal(plan.panes[1].command, "cd '/repo/.omx/agent-worktrees/alpha' && exec ${SHELL:-bash}");
  assert.deepEqual(
    plan.tmuxCommands.find((command) => command.role === 'sidebar' && command.args[0] === 'resize-pane').args,
    ['resize-pane', '-t', 'guardex-dev:0.0', '-x', '40'],
  );
});

test('plans two sessions as tiled agent panes beside the sidebar', () => {
  const plan = planCockpitLayout({
    sessions: [session('alpha'), session('beta')],
    selectedSessionId: 'beta',
    terminalColumns: 134,
    terminalRows: 40,
  });

  const agents = plan.panes.filter((pane) => pane.role === 'agent');
  assert.equal(agents.length, 2);
  assert.deepEqual(agents.map((pane) => pane.target), ['guardex:0.1', 'guardex:0.2']);
  assert.deepEqual(agents.map((pane) => pane.width), [50, 50]);
  assert.deepEqual(agents.map((pane) => pane.height), [40, 40]);
  assert.deepEqual(agents.map((pane) => pane.selected), [false, true]);
  assert.deepEqual(
    plan.tmuxCommands.find((command) => command.role === 'layout').args,
    ['select-layout', '-t', 'guardex:0', 'tiled'],
  );
  assert.equal(plan.panes.some((pane) => pane.role === 'details'), false);
});

test('plans four sessions as a two by two agent grid', () => {
  const plan = planCockpitLayout({
    sessions: [session('alpha'), session('beta'), session('gamma'), session('delta')],
    selectedSessionId: 'gamma',
    terminalColumns: 154,
    terminalRows: 50,
  });

  const agents = plan.panes.filter((pane) => pane.role === 'agent');
  assert.deepEqual(agents.map((pane) => pane.target), [
    'guardex:0.1',
    'guardex:0.2',
    'guardex:0.3',
    'guardex:0.4',
  ]);
  assert.deepEqual(
    agents.map((pane) => [pane.x, pane.y, pane.width, pane.height]),
    [
      [34, 0, 60, 25],
      [94, 0, 60, 25],
      [34, 25, 60, 25],
      [94, 25, 60, 25],
    ],
  );
  assert.deepEqual(agents.map((pane) => pane.selected), [false, false, true, false]);
  assert.equal(plan.tmuxCommands.filter((command) => command.args[0] === 'send-keys').length, 5);
});
