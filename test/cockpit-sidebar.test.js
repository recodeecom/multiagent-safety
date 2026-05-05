const { test } = require('node:test');
const assert = require('node:assert/strict');

const { renderSidebar } = require('../src/cockpit/sidebar');

function lines(output) {
  return output.trimEnd().split('\n');
}

function stripAnsi(output) {
  return output.replace(/\x1b\[[0-9;]*m/g, '');
}

test('renderSidebar renders an empty repo sidebar', () => {
  const output = renderSidebar({
    repoPath: '/work/gitguardex',
    sessions: [],
  }, { noColor: true });

  assert.deepEqual(lines(output), [
    'gx cockpit',
    'gitguardex',
    '  no agent lanes',
    '  [n]ew agent  [t]erminal',
    '  [l]ogs       [p]rojects',
    '  [s]ettings   [?] shortcuts',
  ]);
});

test('renderSidebar renders multiple dmux-style agent rows', () => {
  const output = renderSidebar({
    repoName: 'gitguardex',
    sessions: [
      {
        id: 's1',
        agentName: 'codex',
        branch: 'agent/codex/first',
        task: 'build sidebar',
        status: 'working',
        worktreeExists: true,
      },
      {
        id: 's2',
        agentName: 'claude-code',
        branch: 'agent/claude/second',
        task: 'review cockpit',
        status: 'idle',
        worktreeExists: true,
      },
    ],
  }, { width: 42, noColor: true });

  assert.match(output, /^  build sidebar\s+\[cx\] \(active\)$/m);
  assert.match(output, /^  review cockpit\s+\[cc\] \(waiting\)$/m);
});

test('renderSidebar marks the selected row', () => {
  const output = renderSidebar({
    repoName: 'gitguardex',
    selectedSessionId: 's2',
    sessions: [
      {
        id: 's1',
        agentName: 'codex',
        branch: 'agent/codex/first',
        task: 'first lane',
        status: 'idle',
        worktreeExists: true,
      },
      {
        id: 's2',
        agentName: 'claude',
        branch: 'agent/claude/selected',
        task: 'selected lane',
        status: 'working',
        worktreeExists: true,
      },
    ],
  }, { width: 40, noColor: true });

  assert.match(output, /^  first lane\s+\[cx\] \(waiting\)$/m);
  assert.match(output, /^> selected lane\s+\[cc\] \(active\)$/m);
});

test('renderSidebar exposes hidden closed and missing worktree states', () => {
  const output = renderSidebar({
    repoName: 'gitguardex',
    sessions: [
      {
        id: 'hidden',
        agentName: 'codex',
        task: 'quiet lane',
        status: 'working',
        hidden: true,
        worktreeExists: true,
      },
      {
        id: 'closed',
        agentName: 'claude',
        task: 'closed lane',
        status: 'idle',
        closed: true,
        worktreeExists: true,
      },
      {
        id: 'missing',
        agentName: 'cursor',
        task: 'missing lane',
        status: 'stalled',
        worktreeExists: false,
      },
    ],
  }, { width: 40, noColor: true });

  assert.match(output, /^  quiet lane\s+\[cx\] \(hidden\)$/m);
  assert.match(output, /^  closed lane\s+\[cc\] \(closed\)$/m);
  assert.match(output, /^  missing lane\s+\[cu\] \(missing\)$/m);
});

test('renderSidebar truncates long names cleanly', () => {
  const output = renderSidebar({
    repoName: 'gitguardex',
    sessions: [
      {
        id: 'long',
        agentName: 'codex',
        branch: 'agent/codex/long',
        task: 'this lane name is much too long for the dmux sidebar',
        status: 'working',
        worktreeExists: true,
      },
    ],
  }, { width: 34, noColor: true });

  assert.ok(lines(output).every((line) => line.length <= 34));
  assert.match(output, /\.\.\. \[cx\] \(active\)/);
});

test('renderSidebar disables ANSI color for no-color modes', () => {
  const state = {
    repoName: 'gitguardex',
    sessions: [
      {
        id: 'color',
        agentName: 'codex',
        task: 'colored lane',
        status: 'working',
        worktreeExists: true,
      },
    ],
  };

  assert.match(renderSidebar(state, { color: true, env: {} }), /\x1b\[/);
  assert.doesNotMatch(renderSidebar(state, { color: true, noColor: true, env: {} }), /\x1b\[/);
  assert.doesNotMatch(renderSidebar(state, { color: true, env: { NO_COLOR: '1' } }), /\x1b\[/);
});

test('renderSidebar keeps shortcuts visible', () => {
  const output = stripAnsi(renderSidebar({
    repoName: 'gitguardex',
    sessions: [],
  }, { color: true, env: {} }));

  assert.match(output, /\[n\]ew agent/);
  assert.match(output, /\[t\]erminal/);
  assert.match(output, /\[l\]ogs/);
  assert.match(output, /\[p\]rojects/);
  assert.match(output, /\[s\]ettings/);
  assert.match(output, /\[\?\] shortcuts/);
});
