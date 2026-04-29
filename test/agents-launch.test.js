'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildAgentLaunchCommand,
  buildAgentResumeCommand,
} = require('../src/agents/launch');

test('builds codex launch commands with positional prompts', () => {
  assert.equal(
    buildAgentLaunchCommand({
      agentId: 'codex',
      prompt: 'fix tests',
      worktreePath: '/tmp/work tree',
      permissionMode: 'workspace-write',
      sessionId: 'session-1',
    }),
    "cd '/tmp/work tree' && OMX_SESSION_ID='session-1' 'codex' '--permission-mode' 'workspace-write' 'fix tests'",
  );
});

test('builds claude launch commands with option prompts', () => {
  assert.equal(
    buildAgentLaunchCommand({
      agentId: 'claude',
      prompt: 'review code',
      permissionMode: 'acceptEdits',
    }),
    "'claude' '--permission-mode' 'acceptEdits' '--prompt' 'review code'",
  );
});

test('builds opencode launch commands with positional prompts', () => {
  assert.equal(
    buildAgentLaunchCommand({
      agentId: 'opencode',
      prompt: 'implement feature',
    }),
    "'opencode' 'implement feature'",
  );
});

test('builds cursor launch commands with stdin prompts', () => {
  assert.equal(
    buildAgentLaunchCommand({
      agentId: 'cursor',
      prompt: 'inspect current branch',
      worktreePath: '/repo/worktree',
    }),
    "cd '/repo/worktree' && printf %s 'inspect current branch' | 'cursor-agent'",
  );
});

test('builds gemini launch commands with option prompts', () => {
  assert.equal(
    buildAgentLaunchCommand({
      agentId: 'gemini',
      prompt: 'summarize repo',
      sessionId: 'session-2',
    }),
    "OMX_SESSION_ID='session-2' 'gemini' '--prompt' 'summarize repo'",
  );
});

test('quotes prompts with single quotes, newlines, and dollar signs safely', () => {
  const prompt = "say 'hello'\nthen echo $HOME";

  assert.equal(
    buildAgentLaunchCommand({ agentId: 'codex', prompt }),
    "'codex' 'say '\\''hello'\\''\nthen echo $HOME'",
  );

  assert.equal(
    buildAgentLaunchCommand({ agentId: 'gemini', prompt }),
    "'gemini' '--prompt' 'say '\\''hello'\\''\nthen echo $HOME'",
  );

  assert.equal(
    buildAgentLaunchCommand({ agentId: 'cursor', prompt }),
    "printf %s 'say '\\''hello'\\''\nthen echo $HOME' | 'cursor-agent'",
  );
});

test('omits prompts when none are supplied', () => {
  assert.equal(
    buildAgentLaunchCommand({ agentId: 'codex', worktreePath: '/repo' }),
    "cd '/repo' && 'codex'",
  );
});

test('builds resume commands for supported agents', () => {
  assert.equal(buildAgentResumeCommand('codex', 'workspace-write'), "'codex' 'resume' '--permission-mode' 'workspace-write'");
  assert.equal(buildAgentResumeCommand('claude'), "'claude' '--continue'");
  assert.equal(buildAgentResumeCommand('opencode'), "'opencode' 'resume'");
  assert.equal(buildAgentResumeCommand('cursor'), "'cursor-agent' 'resume'");
  assert.equal(buildAgentResumeCommand('gemini'), "'gemini' 'resume'");
});

test('rejects unsupported agents', () => {
  assert.throws(
    () => buildAgentLaunchCommand({ agentId: 'unknown', prompt: 'x' }),
    /Unsupported agent: unknown/,
  );
});
