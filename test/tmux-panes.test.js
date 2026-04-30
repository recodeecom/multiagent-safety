const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const panes = require('../src/tmux/panes');

function fakeTmux(scriptBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-tmux-panes-'));
  const bin = path.join(dir, 'tmux');
  const log = path.join(dir, 'tmux.log');
  fs.writeFileSync(
    bin,
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      'const args = process.argv.slice(2);',
      `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');`,
      scriptBody,
    ].join('\n'),
    'utf8',
  );
  fs.chmodSync(bin, 0o755);
  return { bin, log };
}

function withFakeTmux(scriptBody, callback) {
  const originalTmuxBin = process.env.GUARDEX_TMUX_BIN;
  const fake = fakeTmux(scriptBody);
  process.env.GUARDEX_TMUX_BIN = fake.bin;

  try {
    callback(fake);
  } finally {
    if (originalTmuxBin === undefined) {
      delete process.env.GUARDEX_TMUX_BIN;
    } else {
      process.env.GUARDEX_TMUX_BIN = originalTmuxBin;
    }
  }
}

function readCalls(log) {
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
}

test('listPanes reads a session through GUARDEX_TMUX_BIN and parses panes', () => {
  withFakeTmux(
    [
      "if (args[0] !== 'list-panes') process.exit(9);",
      "const separator = '\\x1f';",
      "console.log(['%1', 'guardex', '0', '0', 'control', 'node', '1'].join(separator));",
      "console.log(['%2', 'guardex', '0', '1', 'worker', 'bash', '0'].join(separator));",
    ].join('\n'),
    ({ log }) => {
      assert.deepEqual(panes.listPanes('guardex'), [
        {
          id: '%1',
          sessionName: 'guardex',
          windowIndex: 0,
          paneIndex: 0,
          title: 'control',
          currentCommand: 'node',
          active: true,
        },
        {
          id: '%2',
          sessionName: 'guardex',
          windowIndex: 0,
          paneIndex: 1,
          title: 'worker',
          currentCommand: 'bash',
          active: false,
        },
      ]);

      const [call] = readCalls(log);
      assert.deepEqual(call.slice(0, 5), ['list-panes', '-s', '-t', 'guardex', '-F']);
      assert.match(call[5], /#\{pane_id\}/);
      assert.match(call[5], /#\{pane_active\}/);
    },
  );
});

test('splitPane and selectLayout use argv arrays without shell expansion', () => {
  withFakeTmux('process.exit(0);', ({ log }) => {
    panes.splitPane('%1', {
      direction: 'horizontal',
      cwd: '/repo path',
      size: 30,
      command: 'gx agents status; echo literal',
    });
    panes.selectLayout('guardex', 'tiled');

    assert.deepEqual(readCalls(log), [
      [
        'split-window',
        '-h',
        '-t',
        '%1',
        '-l',
        '30',
        '-c',
        '/repo path',
        'gx agents status; echo literal',
      ],
      ['select-layout', '-t', 'guardex', 'tiled'],
    ]);
  });
});

test('pane commands target panes with tmux argv primitives', () => {
  withFakeTmux('process.exit(0);', ({ log }) => {
    panes.resizePane('%2', { direction: 'left', cells: 5 });
    panes.resizePane('%2', { width: 120, height: 40 });
    panes.sendCommand('%2', 'npm test && echo literal');
    panes.killPane('%3');
    panes.setPaneTitle('%2', 'status pane');

    assert.deepEqual(readCalls(log), [
      ['resize-pane', '-t', '%2', '-L', '5'],
      ['resize-pane', '-t', '%2', '-x', '120', '-y', '40'],
      ['send-keys', '-t', '%2', 'npm test && echo literal', 'C-m'],
      ['kill-pane', '-t', '%3'],
      ['select-pane', '-t', '%2', '-T', 'status pane'],
    ]);
  });
});

test('pane primitives reject invalid values before calling tmux', () => {
  assert.throws(() => panes.listPanes(''), /tmux session name/);
  assert.throws(() => panes.splitPane('', {}), /tmux pane target/);
  assert.throws(() => panes.splitPane('%1', { direction: 'diagonal' }), /horizontal or vertical/);
  assert.throws(() => panes.resizePane('%1', {}), /requires direction/);
  assert.throws(() => panes.resizePane('%1', { direction: 'sideways' }), /left, right, up, or down/);
  assert.throws(() => panes.resizePane('%1', { width: 0 }), /positive integer/);
  assert.throws(() => panes.sendCommand('%1', 42), /tmux command/);
  assert.throws(() => panes.killPane(''), /tmux pane target/);
  assert.throws(() => panes.setPaneTitle('%1', ''), /tmux pane title/);
});
