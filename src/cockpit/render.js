function line(label, value) {
  return `${label}: ${value || '-'}`;
}

function lockSummary(locks) {
  if (!Array.isArray(locks) || locks.length === 0) {
    return 'none';
  }

  const preview = locks.slice(0, 3).join(', ');
  const suffix = locks.length > 3 ? `, +${locks.length - 3} more` : '';
  return `${locks.length} (${preview}${suffix})`;
}

function renderSession(session, index) {
  const lines = [
    `${index + 1}. ${session.agentName || 'agent'} | ${session.status || 'unknown'}`,
    `   branch: ${session.branch || '-'}`,
    `   worktree: ${session.worktreePath || '-'}`,
    `   locks: ${lockSummary(session.locks)}`,
  ];

  if (session.task) {
    lines.push(`   task: ${session.task}`);
  }
  if (session.lastHeartbeatAt) {
    lines.push(`   heartbeat: ${session.lastHeartbeatAt}`);
  }

  return lines.join('\n');
}

function renderCockpit(state) {
  const sessions = Array.isArray(state && state.sessions) ? state.sessions : [];
  const lines = [
    'GitGuardex Cockpit',
    line('repo', state && state.repoPath),
    line('base', state && state.baseBranch),
    line('active sessions', String(sessions.length)),
    '',
  ];

  if (sessions.length === 0) {
    lines.push('No active agent sessions.');
  } else {
    sessions.forEach((session, index) => {
      if (index > 0) {
        lines.push('');
      }
      lines.push(renderSession(session, index));
    });
  }

  return `${lines.join('\n')}\n`;
}

module.exports = {
  renderCockpit,
  renderSession,
  lockSummary,
};
