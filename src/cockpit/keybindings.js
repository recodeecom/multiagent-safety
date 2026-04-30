'use strict';

const VALID_MODES = new Set(['main', 'menu', 'settings', 'prompt']);

function action(type, payload = {}) {
  return { type, payload };
}

const NAVIGATION_BINDINGS = {
  j: action('next'),
  down: action('next'),
  k: action('previous'),
  up: action('previous'),
  enter: action('view-selected'),
};

const MAIN_BINDINGS = {
  n: action('new-agent'),
  t: action('terminal'),
  m: action('menu'),
  s: action('settings'),
  f: action('files'),
  d: action('diff'),
  l: action('locks'),
  y: action('sync'),
  F: action('finish'),
  c: action('cleanup-sessions'),
  r: action('doctor'),
  q: action('quit'),
  ...NAVIGATION_BINDINGS,
};

const BASE_BINDINGS = {
  main: MAIN_BINDINGS,
  menu: {
    ...NAVIGATION_BINDINGS,
    esc: action('close-menu'),
    q: action('quit'),
  },
  settings: {
    ...NAVIGATION_BINDINGS,
    esc: action('close-settings'),
    q: action('quit'),
  },
  prompt: {},
};

function cloneAction(binding) {
  return action(binding.type, { ...binding.payload });
}

function cloneBindings(bindings) {
  return Object.fromEntries(
    Object.entries(bindings).map(([mode, modeBindings]) => [
      mode,
      Object.fromEntries(
        Object.entries(modeBindings).map(([key, binding]) => [key, cloneAction(binding)]),
      ),
    ]),
  );
}

function defaultKeybindings() {
  return cloneBindings(BASE_BINDINGS);
}

function normalizeMode(context = {}) {
  return VALID_MODES.has(context.mode) ? context.mode : 'main';
}

function normalizeKey(key) {
  if (key && typeof key === 'object') {
    return normalizeKey(key.name || key.sequence || key.key || '');
  }
  if (key === '\r' || key === '\n') return 'enter';
  if (key === '\x1b') return 'esc';
  if (typeof key !== 'string') return '';

  const normalized = key.trim();
  if (normalized.length === 1) return normalized;

  const namedKey = normalized.toLowerCase();
  if (namedKey === 'arrowdown') return 'down';
  if (namedKey === 'arrowup') return 'up';
  if (namedKey === 'return') return 'enter';
  if (namedKey === 'escape') return 'esc';
  return namedKey;
}

function resolveKeyAction(key, context = {}) {
  const mode = normalizeMode(context);
  const normalizedKey = normalizeKey(key);
  const keybindings = context.keybindings || BASE_BINDINGS;
  const binding = keybindings[mode] && keybindings[mode][normalizedKey];

  if (!binding) {
    return action('noop', { key: normalizedKey, mode });
  }

  return action(binding.type, {
    ...binding.payload,
    key: normalizedKey,
    mode,
  });
}

module.exports = {
  defaultKeybindings,
  resolveKeyAction,
};
