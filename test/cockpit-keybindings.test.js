'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  defaultKeybindings,
  resolveKeyAction,
} = require('../src/cockpit/keybindings');

test('defaultKeybindings exposes dmux-style cockpit commands for main mode', () => {
  const bindings = defaultKeybindings();

  assert.equal(bindings.main.n.type, 'new-agent');
  assert.equal(bindings.main.t.type, 'terminal');
  assert.equal(bindings.main.m.type, 'menu');
  assert.equal(bindings.main.s.type, 'settings');
  assert.equal(bindings.main.f.type, 'files');
  assert.equal(bindings.main.d.type, 'diff');
  assert.equal(bindings.main.l.type, 'locks');
  assert.equal(bindings.main.y.type, 'sync');
  assert.equal(bindings.main.F.type, 'finish');
  assert.equal(bindings.main.c.type, 'cleanup-sessions');
  assert.equal(bindings.main.r.type, 'doctor');
  assert.equal(bindings.main.q.type, 'quit');
});

test('resolveKeyAction maps main mode keys to structured actions', () => {
  assert.deepEqual(resolveKeyAction('n', { mode: 'main' }), {
    type: 'new-agent',
    payload: { key: 'n', mode: 'main' },
  });
  assert.deepEqual(resolveKeyAction('F', { mode: 'main' }), {
    type: 'finish',
    payload: { key: 'F', mode: 'main' },
  });
  assert.deepEqual(resolveKeyAction('ArrowDown', { mode: 'main' }), {
    type: 'next',
    payload: { key: 'down', mode: 'main' },
  });
  assert.deepEqual(resolveKeyAction({ name: 'down' }, { mode: 'main' }), {
    type: 'next',
    payload: { key: 'down', mode: 'main' },
  });
  assert.deepEqual(resolveKeyAction('\r', { mode: 'main' }), {
    type: 'view-selected',
    payload: { key: 'enter', mode: 'main' },
  });
});

test('resolveKeyAction keeps menu mode focused on navigation and closing', () => {
  assert.deepEqual(resolveKeyAction('j', { mode: 'menu' }), {
    type: 'next',
    payload: { key: 'j', mode: 'menu' },
  });
  assert.deepEqual(resolveKeyAction('up', { mode: 'menu' }), {
    type: 'previous',
    payload: { key: 'up', mode: 'menu' },
  });
  assert.deepEqual(resolveKeyAction('enter', { mode: 'menu' }), {
    type: 'view-selected',
    payload: { key: 'enter', mode: 'menu' },
  });
  assert.deepEqual(resolveKeyAction('esc', { mode: 'menu' }), {
    type: 'close-menu',
    payload: { key: 'esc', mode: 'menu' },
  });
  assert.deepEqual(resolveKeyAction('n', { mode: 'menu' }), {
    type: 'noop',
    payload: { key: 'n', mode: 'menu' },
  });
});

test('resolveKeyAction keeps settings mode focused on navigation and closing', () => {
  assert.deepEqual(resolveKeyAction('k', { mode: 'settings' }), {
    type: 'previous',
    payload: { key: 'k', mode: 'settings' },
  });
  assert.deepEqual(resolveKeyAction('down', { mode: 'settings' }), {
    type: 'next',
    payload: { key: 'down', mode: 'settings' },
  });
  assert.deepEqual(resolveKeyAction('enter', { mode: 'settings' }), {
    type: 'view-selected',
    payload: { key: 'enter', mode: 'settings' },
  });
  assert.deepEqual(resolveKeyAction('escape', { mode: 'settings' }), {
    type: 'close-settings',
    payload: { key: 'esc', mode: 'settings' },
  });
  assert.deepEqual(resolveKeyAction('f', { mode: 'settings' }), {
    type: 'noop',
    payload: { key: 'f', mode: 'settings' },
  });
});

test('resolveKeyAction defaults unknown modes to main and unknown keys to noop', () => {
  assert.deepEqual(resolveKeyAction('q', { mode: 'sideways' }), {
    type: 'quit',
    payload: { key: 'q', mode: 'main' },
  });
  assert.deepEqual(resolveKeyAction('x', { mode: 'main' }), {
    type: 'noop',
    payload: { key: 'x', mode: 'main' },
  });
});
