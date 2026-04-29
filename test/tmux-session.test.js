const test = require('node:test');
const assert = require('node:assert/strict');

const tmuxCommand = require('../src/tmux/command');
const tmuxSession = require('../src/tmux/session');

function withMockedTmux(callback) {
  const calls = [];
  const originalRunTmux = tmuxCommand.runTmux;
  tmuxCommand.runTmux = (args, options) => {
    calls.push({ args, options });
    return { status: 0, stdout: '', stderr: '' };
  };

  try {
    callback(calls);
  } finally {
    tmuxCommand.runTmux = originalRunTmux;
  }
}

test('sessionExists checks target session without shell command strings', () => {
  withMockedTmux((calls) => {
    assert.equal(tmuxSession.sessionExists('gx-cockpit'), true);
    assert.deepEqual(calls, [
      {
        args: ['has-session', '-t', 'gx-cockpit'],
        options: { stdio: 'pipe' },
      },
    ]);
  });
});

test('createSession builds detached session argv with cwd', () => {
  withMockedTmux((calls) => {
    tmuxSession.createSession('gx-cockpit', '/repo');
    assert.deepEqual(calls, [
      {
        args: ['new-session', '-d', '-s', 'gx-cockpit', '-c', '/repo'],
        options: undefined,
      },
    ]);
  });
});

test('attachSession attaches with inherited stdio', () => {
  withMockedTmux((calls) => {
    tmuxSession.attachSession('gx-cockpit');
    assert.deepEqual(calls, [
      {
        args: ['attach-session', '-t', 'gx-cockpit'],
        options: { stdio: 'inherit' },
      },
    ]);
  });
});

test('newWindowOrPane creates named window argv', () => {
  withMockedTmux((calls) => {
    tmuxSession.newWindowOrPane({
      target: 'gx-cockpit',
      name: 'status',
      cwd: '/repo',
    });
    assert.deepEqual(calls, [
      {
        args: ['new-window', '-t', 'gx-cockpit', '-n', 'status', '-c', '/repo'],
        options: undefined,
      },
    ]);
  });
});

test('newWindowOrPane creates split pane argv', () => {
  withMockedTmux((calls) => {
    tmuxSession.newWindowOrPane({
      pane: true,
      split: 'horizontal',
      target: 'gx-cockpit:0',
      cwd: '/repo',
    });
    assert.deepEqual(calls, [
      {
        args: ['split-window', '-h', '-t', 'gx-cockpit:0', '-c', '/repo'],
        options: undefined,
      },
    ]);
  });
});

test('sendKeys targets pane and sends command as one argv value', () => {
  withMockedTmux((calls) => {
    tmuxSession.sendKeys('%1', 'gx status; echo still-literal');
    assert.deepEqual(calls, [
      {
        args: ['send-keys', '-t', '%1', 'gx status; echo still-literal', 'C-m'],
        options: undefined,
      },
    ]);
  });
});

test('session helpers reject empty target values', () => {
  assert.throws(() => tmuxSession.sessionExists(''), /non-empty string/);
  assert.throws(() => tmuxSession.createSession('gx', ''), /cwd/);
  assert.throws(
    () => tmuxSession.newWindowOrPane({ pane: true, split: 'diagonal' }),
    /horizontal or vertical/,
  );
  assert.throws(() => tmuxSession.sendKeys('', 'gx status'), /pane id/);
});
