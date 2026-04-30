'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildLaneMenu,
  renderLaneMenu,
} = require('../src/cockpit/menu');

function itemById(menu, id) {
  return menu.items.find((item) => item.id === id);
}

function enabledIds(menu) {
  return menu.items.filter((item) => item.enabled).map((item) => item.id);
}

test('buildLaneMenu returns the expected dmux-style lane actions', () => {
  const menu = buildLaneMenu({
    id: 'session-1',
    agentName: 'codex',
    branch: 'agent/codex/example',
    worktreePath: '/repo/.omx/agent-worktrees/example',
    worktreeExists: true,
  });

  assert.deepEqual(
    menu.items.map((item) => item.label),
    [
      'View',
      'Close',
      'Finish / PR',
      'Sync',
      'Rename',
      'Copy Path',
      'Open in Editor',
      'Toggle Autopilot',
      'Add Agent to Worktree',
      'Settings',
    ],
  );
  assert.deepEqual(enabledIds(menu), [
    'view',
    'close',
    'finish-pr',
    'sync',
    'rename',
    'copy-path',
    'open-editor',
    'toggle-autopilot',
    'add-agent-to-worktree',
    'settings',
  ]);
  assert.equal(itemById(menu, 'close').danger, true);
  assert.equal(itemById(menu, 'finish-pr').shortcut, 'f');
});

test('buildLaneMenu disables every lane action when no session is selected', () => {
  const menu = buildLaneMenu(null);

  assert.equal(menu.laneLabel, 'No lane selected');
  assert.deepEqual(enabledIds(menu), []);
  for (const item of menu.items) {
    assert.equal(item.enabled, false);
    assert.equal(item.reason, 'No session selected');
  }
});

test('buildLaneMenu disables worktree actions when the worktree is missing', () => {
  const menu = buildLaneMenu({
    id: 'session-1',
    agentName: 'codex',
    branch: 'agent/codex/missing-worktree',
    worktreePath: '/repo/.omx/agent-worktrees/missing',
    worktreeExists: false,
  });

  assert.equal(itemById(menu, 'view').enabled, true);
  assert.equal(itemById(menu, 'close').enabled, true);
  assert.equal(itemById(menu, 'rename').enabled, true);
  assert.equal(itemById(menu, 'settings').enabled, true);

  for (const id of ['finish-pr', 'sync', 'copy-path', 'open-editor', 'toggle-autopilot', 'add-agent-to-worktree']) {
    const item = itemById(menu, id);
    assert.equal(item.enabled, false, id);
    assert.match(item.reason, /Worktree missing/);
  }
});

test('buildLaneMenu disables branch actions when the branch is missing', () => {
  const menu = buildLaneMenu({
    id: 'session-1',
    agentName: 'codex',
    worktreePath: '/repo/.omx/agent-worktrees/example',
    worktreeExists: true,
  });

  assert.equal(itemById(menu, 'view').enabled, true);
  assert.equal(itemById(menu, 'copy-path').enabled, true);
  assert.equal(itemById(menu, 'open-editor').enabled, true);
  assert.equal(itemById(menu, 'add-agent-to-worktree').enabled, true);
  assert.equal(itemById(menu, 'settings').enabled, true);

  for (const id of ['close', 'finish-pr', 'sync', 'rename', 'toggle-autopilot']) {
    const item = itemById(menu, id);
    assert.equal(item.enabled, false, id);
    assert.match(item.reason, /Branch missing/);
  }
});

test('renderLaneMenu renders a boxed menu with an ASCII fallback', () => {
  const menu = buildLaneMenu({
    agent: 'codex',
    branch: 'agent/codex/example',
    worktreePath: '/repo/.omx/agent-worktrees/example',
    worktreeExists: true,
  });

  const unicodeOutput = renderLaneMenu(menu, { selectedIndex: 2 });
  assert.match(unicodeOutput, /^┌/);
  assert.match(unicodeOutput, /> \[f\] Finish \/ PR/);

  const asciiOutput = renderLaneMenu(menu, { unicode: false });
  assert.match(asciiOutput, /^\+/);
  assert.match(asciiOutput, /\| Lane Menu/);
  assert.match(asciiOutput, /\[y\] Copy Path/);
});
