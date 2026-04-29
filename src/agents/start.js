const { path } = require('../context');
const { currentBranchName } = require('../git');
const { buildAgentLaunchCommand } = require('./launch');
const { resolveAgent } = require('./registry');

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

module.exports = {
  buildStartPlan,
  dryRunStart,
  renderDryRunPlan,
  sanitizeSlug,
};
