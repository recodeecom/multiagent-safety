const test = require('node:test');
const assert = require('node:assert/strict');

const runtime = require('../src/core/runtime');
const tmuxCommand = require('../src/tmux/command');

test('runTmux delegates to runtime command helper with argv array', () => {
  const calls = [];
  const originalRun = runtime.run;
  runtime.run = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };

  try {
    const result = tmuxCommand.runTmux(['display-message', '-p', '#S'], {
      cwd: '/tmp/project',
    });

    assert.equal(result.status, 0);
    assert.deepEqual(calls, [
      {
        cmd: 'tmux',
        args: ['display-message', '-p', '#S'],
        options: { cwd: '/tmp/project' },
      },
    ]);
  } finally {
    runtime.run = originalRun;
  }
});

test('runTmux rejects non-array args', () => {
  assert.throws(() => tmuxCommand.runTmux('tmux -V'), /args must be an array/);
});

test('runTmux rejects non-string args', () => {
  assert.throws(() => tmuxCommand.runTmux(['new-session', 7]), /only strings/);
});

test('isTmuxAvailable probes tmux version', () => {
  const calls = [];
  const originalRun = runtime.run;
  runtime.run = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    return { status: 0, stdout: 'tmux 3.4\n', stderr: '' };
  };

  try {
    assert.equal(tmuxCommand.isTmuxAvailable(), true);
    assert.deepEqual(calls, [
      { cmd: 'tmux', args: ['-V'], options: { stdio: 'pipe' } },
    ]);
  } finally {
    runtime.run = originalRun;
  }
});

test('isTmuxAvailable returns false when probe fails', () => {
  const originalRun = runtime.run;
  runtime.run = () => ({ status: 127, error: new Error('missing tmux') });

  try {
    assert.equal(tmuxCommand.isTmuxAvailable(), false);
  } finally {
    runtime.run = originalRun;
  }
});
