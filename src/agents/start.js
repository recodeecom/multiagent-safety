const {
  path,
  TOOL_NAME,
  SHORT_TOOL_NAME,
} = require('../context');
const { runPackageAsset } = require('../core/runtime');
const { currentBranchName } = require('../git');
const { buildAgentLaunchCommand } = require('./launch');
const { resolveAgent } = require('./registry');
const {
  createAgentSession,
  listAgentSessions,
  sessionFilePath,
  updateAgentSession,
} = require('./sessions');

function sanitizeSlug(value, fallback = 'task') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shortenSlug(slug, maxLength) {
  if (slug.length <= maxLength) return slug;
  const shortened = slug.slice(0, maxLength).replace(/-+$/, '');
  return shortened || slug.slice(0, maxLength);
}

function branchTimestamp(env = process.env, now = new Date()) {
  if (env.GUARDEX_BRANCH_TIMESTAMP) {
    return env.GUARDEX_BRANCH_TIMESTAMP;
  }
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('-');
}

function worktreeLeaf(repoRoot, branchName) {
  const repoPrefix = path.basename(repoRoot);
  const withoutPrefix = branchName.startsWith('agent/') ? branchName.slice('agent/'.length) : branchName;
  return `${repoPrefix}__${withoutPrefix.replace(/\//g, '__')}`;
}

function buildStartPlan(options, repoRoot, env = process.env) {
  const task = String(options.task || '').trim();
  if (!task) {
    throw new Error('gx agents start --dry-run requires a task');
  }
  const agent = resolveAgent(options.agent || 'codex');
  const taskSlug = sanitizeSlug(task, 'task');
  const taskSlugMax = normalizePositiveInt(env.GUARDEX_BRANCH_TASK_SLUG_MAX, 40);
  const branchDescriptor = `${shortenSlug(taskSlug, taskSlugMax)}-${branchTimestamp(env)}`;
  const branchName = `agent/${agent.id}/${branchDescriptor}`;
  const worktreeRoot = agent.worktreeRoot || (agent.id === 'claude' ? '.omc/agent-worktrees' : '.omx/agent-worktrees');
  const worktreePath = path.join(repoRoot, worktreeRoot, worktreeLeaf(repoRoot, branchName));
  const base = options.base || currentBranchName(repoRoot) || 'main';
  return {
    task,
    taskSlug,
    agent,
    base,
    branchName,
    worktreePath,
    launchCommand: buildAgentLaunchCommand({ agentId: agent.id, prompt: task, worktreePath }),
  };
}

function renderDryRunPlan(plan) {
  return [
    '[gitguardex] Agents start dry-run:',
    `  task: ${plan.task}`,
    `  agent: ${plan.agent.id}`,
    `  base: ${plan.base}`,
    `  task slug: ${plan.taskSlug}`,
    `  branch: ${plan.branchName}`,
    `  worktree: ${plan.worktreePath}`,
    `  launch: ${plan.launchCommand}`,
    '[gitguardex] No branch, worktree, session metadata, or agent process was created.',
  ].join('\n');
}

function dryRunStart(options, repoRoot) {
  return renderDryRunPlan(buildStartPlan(options, repoRoot));
}

function isSpawnFailure(result) {
  return Boolean(result?.error) && typeof result?.status !== 'number';
}

function extractAgentBranchStartMetadata(output) {
  const outputText = String(output || '');
  const branchMatch = outputText.match(/^\[agent-branch-start\] (?:Created branch|Reusing existing branch): (.+)$/m);
  const worktreeMatch = outputText.match(/^\[agent-branch-start\] Worktree: (.+)$/m);
  return {
    branch: branchMatch ? branchMatch[1].trim() : '',
    worktreePath: worktreeMatch ? worktreeMatch[1].trim() : '',
  };
}

function sanitizeBranchForFile(branch) {
  return String(branch || 'session')
    .replace(/[^a-zA-Z0-9._-]+/g, '__')
    .replace(/^_+|_+$/g, '') || 'session';
}

function agentSessionIdForBranch(branch) {
  return sanitizeBranchForFile(branch);
}

function buildSessionPayload(options, metadata, status, extra = {}) {
  if (!metadata.branch || !metadata.worktreePath) {
    return null;
  }

  return {
    id: extra.id || agentSessionIdForBranch(metadata.branch),
    task: options.task,
    agent: options.agent || 'codex',
    branch: metadata.branch,
    worktreePath: path.resolve(metadata.worktreePath),
    base: options.base || null,
    status,
    ...extra,
  };
}

function findSessionByBranch(repoRoot, branch) {
  return listAgentSessions(repoRoot).find((session) => session.branch === branch) || null;
}

function writeAgentSession(repoRoot, options, metadata, status, extra = {}) {
  const payload = buildSessionPayload(options, metadata, status, extra);
  if (!payload) {
    return null;
  }

  const existing = findSessionByBranch(repoRoot, metadata.branch);
  if (existing) {
    return updateAgentSession(repoRoot, existing.id, payload);
  }

  return createAgentSession(repoRoot, payload);
}

function writeClaimFailedSession(repoRoot, options, metadata, claimResult) {
  const session = writeAgentSession(repoRoot, options, metadata, 'claim-failed', {
    claimFailure: {
      claims: options.claims,
      exitCode: typeof claimResult.status === 'number' ? claimResult.status : 1,
      stderr: String(claimResult.stderr || '').trim(),
      stdout: String(claimResult.stdout || '').trim(),
    },
  });
  return session ? sessionFilePath(repoRoot, session.id) : '';
}

function buildBranchStartArgs(options) {
  const args = ['--task', options.task, '--agent', options.agent || 'codex'];
  if (options.base) {
    args.push('--base', options.base);
  }
  return args;
}

function buildRecoveryLines(metadata, claims, sessionPath) {
  const quotedClaims = claims.map((claim) => JSON.stringify(claim)).join(' ');
  const lines = [
    `[${TOOL_NAME}] Claim failed after branch/worktree creation.`,
    `[${TOOL_NAME}] Session status: claim-failed`,
  ];
  if (sessionPath) {
    lines.push(`[${TOOL_NAME}] Session record: ${sessionPath}`);
  }
  if (metadata.worktreePath) {
    lines.push(`[${TOOL_NAME}] Recovery: cd ${JSON.stringify(metadata.worktreePath)}`);
  }
  if (metadata.branch) {
    lines.push(`[${TOOL_NAME}] Recovery: ${SHORT_TOOL_NAME} locks claim --branch ${JSON.stringify(metadata.branch)} ${quotedClaims}`);
  }
  lines.push(`[${TOOL_NAME}] Recovery: resolve the lock conflict or invalid path, then rerun the claim command above.`);
  return `${lines.join('\n')}\n`;
}

function startAgentLane(repoRoot, options) {
  const startResult = runPackageAsset('branchStart', buildBranchStartArgs(options), { cwd: repoRoot });
  let stdout = String(startResult.stdout || '');
  let stderr = String(startResult.stderr || '');
  if (isSpawnFailure(startResult)) {
    return {
      status: 1,
      stdout,
      stderr: `${stderr}${startResult.error.message}\n`,
    };
  }
  if (startResult.status !== 0) {
    return {
      status: typeof startResult.status === 'number' ? startResult.status : 1,
      stdout,
      stderr,
    };
  }

  const metadata = extractAgentBranchStartMetadata(stdout);
  if (options.claims.length === 0) {
    writeAgentSession(repoRoot, options, metadata, 'active');
    return { status: 0, stdout, stderr };
  }

  if (!metadata.branch || !metadata.worktreePath) {
    return {
      status: 1,
      stdout,
      stderr: `${stderr}[${TOOL_NAME}] Unable to claim files: branch start output did not include branch/worktree metadata.\n`,
    };
  }

  const claimResult = runPackageAsset(
    'lockTool',
    ['claim', '--branch', metadata.branch, ...options.claims],
    { cwd: metadata.worktreePath },
  );
  stdout += String(claimResult.stdout || '');
  stderr += String(claimResult.stderr || '');
  if (!isSpawnFailure(claimResult) && claimResult.status === 0) {
    writeAgentSession(repoRoot, options, metadata, 'active');
    return { status: 0, stdout, stderr };
  }

  if (isSpawnFailure(claimResult)) {
    stderr += `${claimResult.error.message}\n`;
  }
  const sessionPath = writeClaimFailedSession(repoRoot, options, metadata, claimResult);
  stdout += buildRecoveryLines(metadata, options.claims, sessionPath);
  return {
    status: typeof claimResult.status === 'number' ? claimResult.status : 1,
    stdout,
    stderr,
  };
}

module.exports = {
  buildBranchStartArgs,
  buildStartPlan,
  buildRecoveryLines,
  dryRunStart,
  extractAgentBranchStartMetadata,
  agentSessionIdForBranch,
  renderDryRunPlan,
  sanitizeSlug,
  writeAgentSession,
  startAgentLane,
};
