const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ACTIVE_SESSIONS_DIR = path.join('.omx', 'state', 'active-sessions');
const LOCK_FILE = path.join('.omx', 'state', 'agent-file-locks.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function text(value, fallback = '') {
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim() || fallback;
}

function readGitValue(repoPath, args) {
  try {
    return cp.execFileSync('git', ['-C', repoPath, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return '';
  }
}

function readBaseBranch(repoPath) {
  const configured = readGitValue(repoPath, ['config', '--get', 'multiagent.baseBranch']);
  if (configured) {
    return configured;
  }

  const originHead = readGitValue(repoPath, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  return originHead.replace(/^origin\//, '');
}

function normalizeSession(input, filePath) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const branch = text(input.branch);
  const worktreePath = text(input.worktreePath || input.worktree_path);
  if (!branch && !worktreePath) {
    return null;
  }

  return {
    agentName: text(input.agentName || input.agent || input.cliName, 'agent'),
    branch: branch || '(unknown branch)',
    worktreePath: worktreePath || '(unknown worktree)',
    status: text(input.status || input.state || input.activity, 'unknown'),
    task: text(input.latestTaskPreview || input.taskName || input.task),
    lastHeartbeatAt: text(input.lastHeartbeatAt || input.updatedAt || input.updated_at),
    filePath,
    locks: [],
  };
}

function readActiveSessions(repoPath) {
  const sessionsDir = path.join(repoPath, ACTIVE_SESSIONS_DIR);
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  return fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const filePath = path.join(sessionsDir, entry.name);
      return normalizeSession(readJson(filePath), filePath);
    })
    .filter(Boolean)
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

function readLocksByBranch(repoPath) {
  const parsed = readJson(path.join(repoPath, LOCK_FILE));
  const locks = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.locks : null;
  const byBranch = new Map();
  if (!locks || typeof locks !== 'object' || Array.isArray(locks)) {
    return byBranch;
  }

  for (const [relativePath, entry] of Object.entries(locks)) {
    const branch = text(entry && entry.branch);
    if (!branch) {
      continue;
    }
    if (!byBranch.has(branch)) {
      byBranch.set(branch, []);
    }
    byBranch.get(branch).push(relativePath);
  }

  for (const entries of byBranch.values()) {
    entries.sort((left, right) => left.localeCompare(right));
  }
  return byBranch;
}

function readCockpitState(repoPath = process.cwd()) {
  const resolvedRepoPath = path.resolve(repoPath);
  const locksByBranch = readLocksByBranch(resolvedRepoPath);
  const sessions = readActiveSessions(resolvedRepoPath).map((session) => ({
    ...session,
    locks: locksByBranch.get(session.branch) || [],
  }));

  return {
    repoPath: resolvedRepoPath,
    baseBranch: readBaseBranch(resolvedRepoPath),
    sessions,
  };
}

module.exports = {
  ACTIVE_SESSIONS_DIR,
  LOCK_FILE,
  readCockpitState,
  readActiveSessions,
  readBaseBranch,
  readLocksByBranch,
};
