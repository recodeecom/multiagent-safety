'use strict';

const MENU_ITEMS = [
  { id: 'view', label: 'View', shortcut: 'v', needsSession: true },
  { id: 'close', label: 'Close', shortcut: 'c', danger: true, needsSession: true, needsBranch: true },
  { id: 'finish-pr', label: 'Finish / PR', shortcut: 'f', needsSession: true, needsWorktree: true, needsBranch: true },
  { id: 'sync', label: 'Sync', shortcut: 's', needsSession: true, needsWorktree: true, needsBranch: true },
  { id: 'rename', label: 'Rename', shortcut: 'r', needsSession: true, needsBranch: true },
  { id: 'copy-path', label: 'Copy Path', shortcut: 'y', needsSession: true, needsWorktree: true },
  { id: 'open-editor', label: 'Open in Editor', shortcut: 'e', needsSession: true, needsWorktree: true },
  { id: 'toggle-autopilot', label: 'Toggle Autopilot', shortcut: 'a', needsSession: true, needsWorktree: true, needsBranch: true },
  { id: 'add-agent-to-worktree', label: 'Add Agent to Worktree', shortcut: '+', needsSession: true, needsWorktree: true },
  { id: 'settings', label: 'Settings', shortcut: ',', needsSession: true },
];

const BOX_CHARS = {
  unicode: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  ascii: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
  },
};

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function resolveWorktreeExists(session, context, worktreePath) {
  if (session && typeof session.worktreeExists === 'boolean') return session.worktreeExists;
  if (context && typeof context.worktreeExists === 'boolean') return context.worktreeExists;
  return worktreePath.length > 0;
}

function buildMenuContext(session, context = {}) {
  const selected = Boolean(session) && context.selected !== false;
  const source = session || {};
  const branch = selected ? firstString(source.branch, source.lane && source.lane.branch, context.branch) : '';
  const worktreePath = selected
    ? firstString(
      source.worktreePath,
      source.worktree && source.worktree.path,
      source.path,
      context.worktreePath,
    )
    : '';
  const worktreeExists = selected && resolveWorktreeExists(source, context, worktreePath);

  return {
    selected,
    branch,
    worktreePath,
    worktreeExists,
    sessionId: selected ? firstString(source.id, source.sessionId) : '',
    laneLabel: selected
      ? firstString(source.agentName, source.agent, source.name, source.id, source.branch, 'agent')
      : 'No lane selected',
  };
}

function disabledReason(definition, menuContext) {
  if (definition.needsSession && !menuContext.selected) {
    return 'No session selected';
  }

  const reasons = [];
  if (definition.needsWorktree && !menuContext.worktreeExists) {
    reasons.push('Worktree missing');
  }
  if (definition.needsBranch && !menuContext.branch) {
    reasons.push('Branch missing');
  }

  return reasons.join('; ');
}

function buildLaneMenu(session, context = {}) {
  const menuContext = buildMenuContext(session, context);
  const items = MENU_ITEMS.map((definition) => {
    const reason = disabledReason(definition, menuContext);
    return {
      id: definition.id,
      label: definition.label,
      enabled: reason.length === 0,
      shortcut: definition.shortcut,
      danger: Boolean(definition.danger),
      reason: reason || '',
    };
  });

  return {
    id: 'lane-menu',
    title: context.title || 'Lane Menu',
    sessionId: menuContext.sessionId,
    laneLabel: menuContext.laneLabel,
    branch: menuContext.branch,
    worktreePath: menuContext.worktreePath,
    worktreeExists: menuContext.worktreeExists,
    items,
  };
}

function padRight(value, width) {
  const text = String(value);
  return text + ' '.repeat(Math.max(0, width - text.length));
}

function renderItem(item, index, selectedIndex) {
  const marker = index === selectedIndex ? '>' : ' ';
  const shortcut = item.shortcut ? `[${item.shortcut}]` : '   ';
  const danger = item.danger ? ' !' : '';
  const disabled = item.enabled ? '' : ` - disabled: ${item.reason || 'Unavailable'}`;
  return `${marker} ${shortcut} ${item.label}${danger}${disabled}`;
}

function renderLaneMenu(menu, options = {}) {
  const model = menu && typeof menu === 'object' ? menu : buildLaneMenu(null);
  const items = Array.isArray(model.items) ? model.items : [];
  const selectedIndex = Number.isInteger(options.selectedIndex) ? options.selectedIndex : -1;
  const box = options.unicode === false || options.ascii === true ? BOX_CHARS.ascii : BOX_CHARS.unicode;
  const title = String(options.title || model.title || 'Lane Menu');
  const subtitle = model.branch ? String(model.branch) : String(model.laneLabel || 'No lane selected');
  const rows = [title, subtitle, ...items.map((item, index) => renderItem(item, index, selectedIndex))];
  const contentWidth = Math.max(1, ...rows.map((row) => row.length));
  const rule = box.horizontal.repeat(contentWidth + 2);
  const lines = [
    `${box.topLeft}${rule}${box.topRight}`,
    `${box.vertical} ${padRight(title, contentWidth)} ${box.vertical}`,
    `${box.vertical} ${padRight(subtitle, contentWidth)} ${box.vertical}`,
    ...items.map((item, index) => `${box.vertical} ${padRight(renderItem(item, index, selectedIndex), contentWidth)} ${box.vertical}`),
    `${box.bottomLeft}${rule}${box.bottomRight}`,
  ];

  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildLaneMenu,
  renderLaneMenu,
};
