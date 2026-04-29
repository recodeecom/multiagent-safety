'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const cockpit = require('../src/cockpit');
const {
  startAgentLane,
  normalizeStartResult,
} = require('../src/cockpit/actions');

test('startAgentLane delegates to the gx agents start implementation', () => {
  const calls = [];

  const result = startAgentLane(
    {
      task: 'fix flaky test',
      agent: 'codex',
      base: 'main',
      claims: ['src/foo.js', 'test/foo.test.js'],
    },
    {
      repoRoot: '/repo',
      startImplementation(repoRoot, request) {
        calls.push({ repoRoot, request });
        return {
          ok: true,
          sessionId: 'session-123',
          branch: 'agent/codex/fix-flaky-test',
          worktreePath: '/repo/.omx/agent-worktrees/fix-flaky-test',
          message: 'Started agent lane.',
        };
      },
    },
  );

  assert.deepEqual(calls, [
    {
      repoRoot: '/repo',
      request: {
        task: 'fix flaky test',
        agent: 'codex',
        base: 'main',
        claims: ['src/foo.js', 'test/foo.test.js'],
      },
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    sessionId: 'session-123',
    branch: 'agent/codex/fix-flaky-test',
    worktreePath: '/repo/.omx/agent-worktrees/fix-flaky-test',
    message: 'Started agent lane.',
  });
});

test('startAgentLane falls back to cwd repo root and normalizes missing claims', () => {
  const calls = [];
  const previousCwd = process.cwd();

  try {
    process.chdir(__dirname);
    const result = startAgentLane(
      {
        task: 'fix auth',
        agent: 'codex',
        base: 'main',
      },
      {
        startImplementation(repoRoot, request) {
          calls.push({ repoRoot, request });
          return {
            status: 0,
            stdout:
              '[agent-branch-start] Created branch: agent/codex/fix-auth\n' +
              '[agent-branch-start] Worktree: /repo/.omx/agent-worktrees/fix-auth\n',
          };
        },
      },
    );

    assert.deepEqual(calls, [
      {
        repoRoot: __dirname,
        request: {
          task: 'fix auth',
          agent: 'codex',
          base: 'main',
          claims: [],
        },
      },
    ]);
    assert.deepEqual(result, {
      ok: true,
      sessionId: undefined,
      branch: 'agent/codex/fix-auth',
      worktreePath: '/repo/.omx/agent-worktrees/fix-auth',
      message:
        '[agent-branch-start] Created branch: agent/codex/fix-auth\n' +
        '[agent-branch-start] Worktree: /repo/.omx/agent-worktrees/fix-auth\n',
    });
  } finally {
    process.chdir(previousCwd);
  }
});

test('startAgentLane normalizes async implementation results', async () => {
  const calls = [];
  const result = await startAgentLane(
    { repoRoot: '/repo', task: 'ship feature', agent: 'claude', base: 'dev', claims: [] },
    {
      async startAgentLane(repoRoot, request) {
        calls.push({ repoRoot, request });
        return {
          session: { id: 'session-async' },
          lane: { branch: 'agent/claude/ship-feature' },
          worktree: { path: '/repo/.omx/agent-worktrees/ship-feature' },
        };
      },
    },
  );

  assert.deepEqual(calls, [
    {
      repoRoot: '/repo',
      request: {
        task: 'ship feature',
        agent: 'claude',
        base: 'dev',
        claims: [],
      },
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    sessionId: 'session-async',
    branch: 'agent/claude/ship-feature',
    worktreePath: '/repo/.omx/agent-worktrees/ship-feature',
    message: 'Started agent lane.',
  });
});

test('cockpit index exports startAgentLane action without dropping render API', () => {
  assert.equal(cockpit.startAgentLane, startAgentLane);
  assert.equal(cockpit.actions.startAgentLane, startAgentLane);
  assert.equal(typeof cockpit.render, 'function');
  assert.equal(typeof cockpit.startCockpit, 'function');
});

test('normalizeStartResult preserves failure shape', () => {
  assert.deepEqual(normalizeStartResult({ ok: false, message: 'missing agent' }), {
    ok: false,
    sessionId: undefined,
    branch: undefined,
    worktreePath: undefined,
    message: 'missing agent',
  });
});
