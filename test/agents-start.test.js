const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function loadStartWithMocks({
  runPackageAsset,
  createAgentSession,
  updateAgentSession,
  currentBranchName,
  listAgentSessions = () => [],
}) {
  const startPath = require.resolve('../src/agents/start');
  const runtimePath = require.resolve('../src/core/runtime');
  const sessionsPath = require.resolve('../src/agents/sessions');
  const gitPath = require.resolve('../src/git');
  const originalLoad = Module._load;

  delete require.cache[startPath];
  Module._load = function mockLoad(request, parent, isMain) {
    const resolved = Module._resolveFilename(request, parent, isMain);
    if (resolved === runtimePath) {
      return { runPackageAsset };
    }
    if (resolved === sessionsPath) {
      return { createAgentSession, updateAgentSession, listAgentSessions };
    }
    if (resolved === gitPath) {
      return { currentBranchName };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    return require(startPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[startPath];
  }
}

function branchStartOutput(branch = 'agent/codex/fix-auth', worktreePath = '/repo/.omx/agent-worktrees/repo__codex__fix-auth') {
  return [
    `[agent-branch-start] Created branch: ${branch}`,
    `[agent-branch-start] Worktree: ${worktreePath}`,
    '',
  ].join('\n');
}

test('agents start creates canonical session after successful branch start', () => {
  const runCalls = [];
  const created = [];
  const start = loadStartWithMocks({
    runPackageAsset(assetKey, args, options) {
      runCalls.push({ assetKey, args, options });
      return { status: 0, stdout: branchStartOutput(), stderr: '' };
    },
    createAgentSession(repoRoot, payload) {
      created.push({ repoRoot, payload });
      return {
        id: 'session-1',
        ...payload,
        createdAt: '2026-04-29T20:00:00.000Z',
        updatedAt: '2026-04-29T20:00:00.000Z',
      };
    },
    updateAgentSession() {
      throw new Error('unexpected update');
    },
    currentBranchName: () => 'main',
  });

  const result = start.startAgentLane('/repo', {
    task: 'fix auth',
    agent: 'codex',
    base: 'main',
    claims: [],
  });

  assert.equal(result.status, 0);
  assert.deepEqual(created, [
    {
      repoRoot: '/repo',
      payload: {
        task: 'fix auth',
        agent: 'codex',
        id: 'agent__codex__fix-auth',
        branch: 'agent/codex/fix-auth',
        worktreePath: '/repo/.omx/agent-worktrees/repo__codex__fix-auth',
        base: 'main',
        claims: [],
        metadata: {},
        launchCommand: "cd '/repo/.omx/agent-worktrees/repo__codex__fix-auth' && 'codex' 'fix auth'",
        tmux: null,
        status: 'active',
      },
    },
  ]);
  assert.equal(runCalls.length, 1);
});

test('agents start branch failure creates no session', () => {
  let createCount = 0;
  const start = loadStartWithMocks({
    runPackageAsset() {
      return { status: 2, stdout: '', stderr: 'branch failed\n' };
    },
    createAgentSession() {
      createCount += 1;
    },
    updateAgentSession() {
      throw new Error('unexpected update');
    },
    currentBranchName: () => 'main',
  });

  const result = start.startAgentLane('/repo', {
    task: 'fix auth',
    agent: 'codex',
    base: 'main',
    claims: [],
  });

  assert.equal(result.status, 2);
  assert.equal(createCount, 0);
});

test('agents start claim failure updates canonical session to claim-failed', () => {
  const runCalls = [];
  const created = [];
  const updates = [];
  const start = loadStartWithMocks({
    runPackageAsset(assetKey, args, options) {
      runCalls.push({ assetKey, args, options });
      if (assetKey === 'branchStart') {
        return { status: 0, stdout: branchStartOutput(), stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'claim failed\n' };
    },
    createAgentSession(repoRoot, payload) {
      created.push({ repoRoot, payload });
      return {
        ...payload,
        createdAt: '2026-04-29T20:00:00.000Z',
        updatedAt: '2026-04-29T20:00:00.000Z',
      };
    },
    updateAgentSession(repoRoot, sessionId, patch) {
      updates.push({ repoRoot, sessionId, patch });
      return {
        id: sessionId,
        status: patch.status,
      };
    },
    currentBranchName: () => 'main',
    listAgentSessions: () => created.map((entry) => entry.payload),
  });

  const result = start.startAgentLane('/repo', {
    task: 'fix auth',
    agent: 'codex',
    base: 'main',
    claims: ['src/auth.js'],
  });

  assert.equal(result.status, 1);
  assert.equal(created.length, 1);
  assert.deepEqual(updates, [
    {
      repoRoot: '/repo',
      sessionId: 'agent__codex__fix-auth',
      patch: {
        id: 'agent__codex__fix-auth',
        task: 'fix auth',
        agent: 'codex',
        branch: 'agent/codex/fix-auth',
        worktreePath: '/repo/.omx/agent-worktrees/repo__codex__fix-auth',
        base: 'main',
        claims: ['src/auth.js'],
        metadata: {},
        launchCommand: "cd '/repo/.omx/agent-worktrees/repo__codex__fix-auth' && 'codex' 'fix auth'",
        tmux: null,
        status: 'claim-failed',
        claimFailure: {
          claims: ['src/auth.js'],
          exitCode: 1,
          stderr: 'claim failed',
          stdout: '',
        },
      },
    },
  ]);
  assert.deepEqual(runCalls[1], {
    assetKey: 'lockTool',
    args: ['claim', '--branch', 'agent/codex/fix-auth', 'src/auth.js'],
    options: { cwd: '/repo/.omx/agent-worktrees/repo__codex__fix-auth' },
  });
  assert.match(result.stdout, /Session status: claim-failed/);
});

test('agents start output includes canonical session id', () => {
  const start = loadStartWithMocks({
    runPackageAsset() {
      return { status: 0, stdout: branchStartOutput(), stderr: '' };
    },
    createAgentSession(repoRoot, payload) {
      return {
        ...payload,
      };
    },
    updateAgentSession() {
      throw new Error('unexpected update');
    },
    currentBranchName: () => 'main',
  });

  const result = start.startAgentLane('/repo', {
    task: 'fix auth',
    agent: 'codex',
    base: 'main',
    claims: [],
  });

  assert.match(result.stdout, /\[gitguardex\] Agent session id: agent__codex__fix-auth/);
});

test('agents start launches repeated codex accounts with unique branch tasks', () => {
  const runCalls = [];
  const created = [];
  const branches = [
    ['agent/codex/fix-auth-codex-01', '/repo/.omx/agent-worktrees/repo__codex__fix-auth-codex-01'],
    ['agent/codex/fix-auth-codex-02', '/repo/.omx/agent-worktrees/repo__codex__fix-auth-codex-02'],
  ];
  const start = loadStartWithMocks({
    runPackageAsset(assetKey, args, options) {
      runCalls.push({ assetKey, args, options });
      const branchIndex = runCalls.filter((call) => call.assetKey === 'branchStart').length - 1;
      return { status: 0, stdout: branchStartOutput(branches[branchIndex][0], branches[branchIndex][1]), stderr: '' };
    },
    createAgentSession(repoRoot, payload) {
      created.push({ repoRoot, payload });
      return payload;
    },
    updateAgentSession() {
      throw new Error('unexpected update');
    },
    currentBranchName: () => 'main',
  });

  const result = start.startAgentLane('/repo', {
    task: 'fix auth',
    agent: 'codex',
    count: 2,
    base: 'main',
    claims: [],
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Selected: 2\/10/);
  assert.deepEqual(runCalls.map((call) => call.args), [
    ['--task', 'fix auth codex 01', '--agent', 'codex', '--base', 'main'],
    ['--task', 'fix auth codex 02', '--agent', 'codex', '--base', 'main'],
  ]);
  assert.deepEqual(created.map((entry) => entry.payload.task), ['fix auth', 'fix auth']);
  assert.deepEqual(created.map((entry) => entry.payload.branch), [
    'agent/codex/fix-auth-codex-01',
    'agent/codex/fix-auth-codex-02',
  ]);
});
