'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  COCKPIT_INTENT_ALIASES,
  dispatchCockpitIntent,
  dispatchPaneAction,
} = require('../src/cockpit/pane-actions');

function fakeBackend() {
  const calls = [];
  return {
    name: 'kitty',
    launchTerminalPane(payload) {
      calls.push({ method: 'launchTerminalPane', payload });
      return { ok: true, message: 'spawned terminal pane' };
    },
    calls,
  };
}

test('terminal:open intent routes to runAddTerminal which calls launchTerminalPane', () => {
  const backend = fakeBackend();
  const result = dispatchCockpitIntent(
    { type: 'terminal:open', sessionId: 's1', branch: 'agent/codex/s1', worktreePath: '/repo/.omx/s1' },
    {
      runtime: { terminalBackend: backend },
      repoRoot: '/repo/gitguardex',
    },
  );
  assert.equal(result.ok, true);
  assert.equal(backend.calls.length, 1);
  assert.equal(backend.calls[0].method, 'launchTerminalPane');
  assert.equal(backend.calls[0].payload.actionId, 'add-terminal');
  assert.equal(backend.calls[0].payload.worktreePath, '/repo/.omx/s1');
});

test('terminal:open intent without a session falls back to repoRoot for cwd', () => {
  const backend = fakeBackend();
  const result = dispatchCockpitIntent(
    { type: 'terminal:open' },
    {
      runtime: { terminalBackend: backend },
      repoRoot: '/repo/gitguardex',
    },
  );
  assert.equal(result.ok, true);
  assert.equal(backend.calls[0].payload.repoRoot, '/repo/gitguardex');
});

test('PANE_ACTION_HANDLERS exposes terminal:open as an alias for add-terminal', () => {
  const backend = fakeBackend();
  const aliasResult = dispatchPaneAction('terminal:open', {
    runtime: { terminalBackend: backend },
    repoRoot: '/repo/gitguardex',
  });
  assert.equal(aliasResult.ok, true);
  assert.equal(backend.calls.length, 1);
  assert.equal(backend.calls[0].method, 'launchTerminalPane');
});

test('agent:start intent routes to runAddAgent and forwards task/agent/base', () => {
  const calls = [];
  const result = dispatchCockpitIntent(
    {
      type: 'agent:start',
      task: 'fix auth',
      agent: 'codex',
      base: 'main',
      worktreePath: '/repo/.omx/active',
      branch: 'agent/codex/active',
    },
    {
      runtime: {
        terminalBackend: fakeBackend(),
      },
      startAgentLane(request) {
        calls.push(request);
        return { ok: true, message: 'started agent lane' };
      },
      repoRoot: '/repo/gitguardex',
    },
  );
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].task, 'fix auth');
  assert.equal(calls[0].agent, 'codex');
  assert.equal(calls[0].base, 'main');
  assert.equal(calls[0].worktreePath, '/repo/.omx/active');
});

test('dispatchCockpitIntent with no intent returns a structured failure', () => {
  const result = dispatchCockpitIntent(null, {});
  assert.equal(result.ok, false);
  assert.match(result.message, /No cockpit intent/i);
});

test('COCKPIT_INTENT_ALIASES maps intent types to action ids', () => {
  assert.equal(COCKPIT_INTENT_ALIASES['terminal:open'], 'add-terminal');
  assert.equal(COCKPIT_INTENT_ALIASES['agent:start'], 'add-agent');
});
