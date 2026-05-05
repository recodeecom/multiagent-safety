'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { readControlSnapshot } = require('../src/cockpit/control');

test('readControlSnapshot attaches state.kittyTree when KITTY_LISTEN_ON is set', () => {
  const calls = [];
  const fakeTree = {
    user: 'deadpool',
    sessionLabel: 'gitguardex',
    osWindowId: 7,
    windows: [{ id: 11, title: 'gx cockpit', kind: 'control', isFocused: true }],
    error: '',
  };
  const state = readControlSnapshot({
    repoPath: '/repo/gitguardex',
    env: { KITTY_LISTEN_ON: 'unix:/tmp/test.sock' },
    readState: () => ({ repoPath: '/repo/gitguardex', sessions: [] }),
    readSettings: () => ({}),
    readKittyTree: (opts) => {
      calls.push(opts);
      return fakeTree;
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].repoRoot, '/repo/gitguardex');
  assert.equal(state.kittyTree && state.kittyTree.user, 'deadpool');
  assert.equal(state.kittyTree.windows.length, 1);
});

test('readControlSnapshot leaves kittyTree null when KITTY_LISTEN_ON is unset', () => {
  const state = readControlSnapshot({
    repoPath: '/repo/gitguardex',
    env: {},
    readState: () => ({ repoPath: '/repo/gitguardex', sessions: [] }),
    readSettings: () => ({}),
    readKittyTree: () => {
      throw new Error('readKittyTree should not be called when KITTY_LISTEN_ON is unset');
    },
  });
  assert.equal(state.kittyTree || null, null);
});

test('readControlSnapshot drops kittyTree when the reader returns an error', () => {
  const state = readControlSnapshot({
    repoPath: '/repo/gitguardex',
    env: { KITTY_LISTEN_ON: 'unix:/tmp/test.sock' },
    readState: () => ({ repoPath: '/repo/gitguardex', sessions: [] }),
    readSettings: () => ({}),
    readKittyTree: () => ({
      user: 'deadpool', sessionLabel: 'gitguardex', osWindowId: null, windows: [], error: 'kitty @ ls failed',
    }),
  });
  assert.equal(state.kittyTree || null, null);
});

test('readControlSnapshot is resilient when readKittyTree throws', () => {
  const state = readControlSnapshot({
    repoPath: '/repo/gitguardex',
    env: { KITTY_LISTEN_ON: 'unix:/tmp/test.sock' },
    readState: () => ({ repoPath: '/repo/gitguardex', sessions: [] }),
    readSettings: () => ({}),
    readKittyTree: () => { throw new Error('boom'); },
  });
  // Throw is caught; state still produced, kittyTree absent.
  assert.equal(state.kittyTree || null, null);
});
