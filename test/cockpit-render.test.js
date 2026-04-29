const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const { renderCockpit } = require('../src/cockpit/render');
const { readCockpitState } = require('../src/cockpit/state');
const { render } = require('../src/cockpit');
const { createAgentSession } = require('../src/agents/sessions');

function initRepo() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-cockpit-'));
  cp.execFileSync('git', ['init', '-b', 'main'], { cwd: repoPath, stdio: 'ignore' });
  cp.execFileSync('git', ['config', 'multiagent.baseBranch', 'main'], { cwd: repoPath, stdio: 'ignore' });
  return repoPath;
}

test('renderCockpit returns a readable terminal string', () => {
  const output = renderCockpit({
    repoPath: '/repo/example',
    baseBranch: 'main',
    sessions: [
      {
        agentName: 'codex',
        branch: 'agent/codex/example',
        worktreePath: '/repo/example/.omx/agent-worktrees/example',
        status: 'working',
        task: 'implement cockpit',
        lastHeartbeatAt: '2026-04-29T19:00:00.000Z',
        locks: ['src/cockpit/render.js', 'src/cockpit/state.js', 'test/cockpit-render.test.js', 'README.md'],
      },
    ],
  });

  assert.match(output, /GitGuardex Cockpit/);
  assert.match(output, /repo: \/repo\/example/);
  assert.match(output, /base: main/);
  assert.match(output, /active sessions: 1/);
  assert.match(output, /branch: agent\/codex\/example/);
  assert.match(output, /worktree: \/repo\/example\/\.omx\/agent-worktrees\/example/);
  assert.match(output, /locks: 4 \(src\/cockpit\/render\.js, src\/cockpit\/state\.js, test\/cockpit-render\.test\.js, \+1 more\)/);
  assert.match(output, /task: implement cockpit/);
});

test('readCockpitState reads canonical sessions and lock summaries', () => {
  const repoPath = initRepo();
  createAgentSession(repoPath, {
    id: 'canonical-cockpit',
    agent: 'codex',
    branch: 'agent/codex/example',
    worktreePath: path.join(repoPath, '.omx', 'agent-worktrees', 'example'),
    status: 'working',
    task: 'implement cockpit',
  });
  fs.mkdirSync(path.join(repoPath, '.omx', 'state'), { recursive: true });
  fs.writeFileSync(
    path.join(repoPath, '.omx', 'state', 'agent-file-locks.json'),
    JSON.stringify({
      locks: {
        'src/cockpit/render.js': { branch: 'agent/codex/example' },
        'src/cockpit/state.js': { branch: 'agent/codex/example' },
        'README.md': { branch: 'agent/other/example' },
      },
    }),
    'utf8',
  );

  const state = readCockpitState(repoPath);

  assert.equal(state.repoPath, repoPath);
  assert.equal(state.baseBranch, 'main');
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].status, 'working');
  assert.equal(state.sessions[0].task, 'implement cockpit');
  assert.deepEqual(state.sessions[0].locks, ['src/cockpit/render.js', 'src/cockpit/state.js']);
});

test('readCockpitState still reads legacy .omx active sessions', () => {
  const repoPath = initRepo();
  const sessionsDir = path.join(repoPath, '.omx', 'state', 'active-sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionsDir, 'agent__codex__example.json'),
    JSON.stringify({
      agentName: 'codex',
      branch: 'agent/codex/example',
      worktreePath: path.join(repoPath, '.omx', 'agent-worktrees', 'example'),
      state: 'working',
      latestTaskPreview: 'implement cockpit',
      lastHeartbeatAt: '2026-04-29T19:00:00.000Z',
    }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(repoPath, '.omx', 'state', 'agent-file-locks.json'),
    JSON.stringify({
      locks: {
        'src/cockpit/render.js': { branch: 'agent/codex/example' },
        'src/cockpit/state.js': { branch: 'agent/codex/example' },
        'README.md': { branch: 'agent/other/example' },
      },
    }),
    'utf8',
  );

  const state = readCockpitState(repoPath);

  assert.equal(state.repoPath, repoPath);
  assert.equal(state.baseBranch, 'main');
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].status, 'working');
  assert.deepEqual(state.sessions[0].locks, ['src/cockpit/render.js', 'src/cockpit/state.js']);
});

test('non-interactive render returns a string', () => {
  const repoPath = initRepo();

  const output = render(repoPath);

  assert.equal(typeof output, 'string');
  assert.match(output, /GitGuardex Cockpit/);
  assert.match(output, /No active agent sessions\./);
});
