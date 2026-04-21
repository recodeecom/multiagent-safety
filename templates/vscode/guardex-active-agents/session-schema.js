const fs = require('node:fs');
const path = require('node:path');

const ACTIVE_SESSIONS_RELATIVE_DIR = path.join('.omx', 'state', 'active-sessions');
const SESSION_SCHEMA_VERSION = 1;

function toNonEmptyString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : String(value || '').trim();
  return normalized || fallback;
}

function toPositiveInteger(value) {
  const normalized = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function sanitizeBranchForFile(branch) {
  const normalized = toNonEmptyString(branch, 'session');
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '__').replace(/^_+|_+$/g, '') || 'session';
}

function sessionFileNameForBranch(branch) {
  return `${sanitizeBranchForFile(branch)}.json`;
}

function activeSessionsDirForRepo(repoRoot) {
  return path.join(path.resolve(repoRoot), ACTIVE_SESSIONS_RELATIVE_DIR);
}

function sessionFilePathForBranch(repoRoot, branch) {
  return path.join(activeSessionsDirForRepo(repoRoot), sessionFileNameForBranch(branch));
}

function buildSessionRecord(input) {
  const repoRoot = path.resolve(toNonEmptyString(input.repoRoot));
  const worktreePath = path.resolve(toNonEmptyString(input.worktreePath));
  const branch = toNonEmptyString(input.branch);
  const pid = toPositiveInteger(input.pid);
  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();

  if (!branch) {
    throw new Error('branch is required');
  }
  if (!repoRoot) {
    throw new Error('repoRoot is required');
  }
  if (!worktreePath) {
    throw new Error('worktreePath is required');
  }
  if (!pid) {
    throw new Error('pid must be a positive integer');
  }
  if (Number.isNaN(startedAt.getTime())) {
    throw new Error('startedAt must be a valid date');
  }

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    repoRoot,
    branch,
    taskName: toNonEmptyString(input.taskName, 'task'),
    agentName: toNonEmptyString(input.agentName, 'agent'),
    worktreePath,
    pid,
    cliName: toNonEmptyString(input.cliName, 'codex'),
    startedAt: startedAt.toISOString(),
  };
}

function deriveSessionLabel(branch, worktreePath) {
  const worktreeLeaf = toNonEmptyString(path.basename(worktreePath || ''));
  if (worktreeLeaf) {
    return worktreeLeaf;
  }
  return toNonEmptyString(branch).replace(/[\\/]+/g, '-') || 'unknown-agent';
}

function normalizeSessionRecord(input, options = {}) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const repoRoot = toNonEmptyString(input.repoRoot);
  const branch = toNonEmptyString(input.branch);
  const worktreePath = toNonEmptyString(input.worktreePath);
  const startedAt = new Date(input.startedAt);
  const pid = toPositiveInteger(input.pid);

  if (!repoRoot || !branch || !worktreePath || !pid || Number.isNaN(startedAt.getTime())) {
    return null;
  }

  return {
    schemaVersion: toPositiveInteger(input.schemaVersion) || SESSION_SCHEMA_VERSION,
    repoRoot: path.resolve(repoRoot),
    branch,
    taskName: toNonEmptyString(input.taskName, 'task'),
    agentName: toNonEmptyString(input.agentName, 'agent'),
    worktreePath: path.resolve(worktreePath),
    pid,
    cliName: toNonEmptyString(input.cliName, 'codex'),
    startedAt: startedAt.toISOString(),
    filePath: toNonEmptyString(options.filePath),
    label: deriveSessionLabel(branch, worktreePath),
  };
}

function formatElapsedFrom(startedAt, now = Date.now()) {
  const startedAtMs = startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return '0s';
  }

  const totalSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function isPidAlive(pid) {
  const normalizedPid = toPositiveInteger(pid);
  if (!normalizedPid) {
    return false;
  }

  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function readActiveSessions(repoRoot, options = {}) {
  const activeSessionsDir = activeSessionsDirForRepo(repoRoot);
  if (!fs.existsSync(activeSessionsDir)) {
    return [];
  }

  const now = options.now || Date.now();
  const sessions = [];
  for (const entry of fs.readdirSync(activeSessionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(activeSessionsDir, entry.name);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
      continue;
    }

    const normalized = normalizeSessionRecord(parsed, { filePath });
    if (!normalized) {
      continue;
    }
    if (!options.includeStale && !isPidAlive(normalized.pid)) {
      continue;
    }

    normalized.elapsedLabel = formatElapsedFrom(normalized.startedAt, now);
    sessions.push(normalized);
  }

  sessions.sort((left, right) => {
    const timeDelta = Date.parse(right.startedAt) - Date.parse(left.startedAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return left.label.localeCompare(right.label);
  });

  return sessions;
}

module.exports = {
  ACTIVE_SESSIONS_RELATIVE_DIR,
  SESSION_SCHEMA_VERSION,
  activeSessionsDirForRepo,
  buildSessionRecord,
  deriveSessionLabel,
  formatElapsedFrom,
  isPidAlive,
  normalizeSessionRecord,
  readActiveSessions,
  sanitizeBranchForFile,
  sessionFileNameForBranch,
  sessionFilePathForBranch,
};
