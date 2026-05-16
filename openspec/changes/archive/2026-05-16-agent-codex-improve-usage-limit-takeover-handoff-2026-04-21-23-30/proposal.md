## Why

- When `codex-agent` keeps a sandbox after the first lane exits early, the next
  agent only gets generic merge/cleanup hints and has to reconstruct the exact
  takeover flow by hand.
- Fresh OpenSpec change workspaces do not scaffold a copy-paste takeover note,
  so usage-limit handoffs are inconsistent and easy to botch.

## What Changes

- Make `codex-agent` print a concrete takeover prompt with the existing branch,
  sandbox path, OpenSpec artifact, and finish command whenever auto-finish does
  not complete and the worktree stays alive.
- Teach `init-change-workspace.sh` to scaffold structured `Handoff:` and
  `Copy prompt:` lines, and resolve the cleanup command base branch from repo
  metadata instead of hardcoding `dev`.
- Add regression coverage for both the launcher handoff output and the scaffold
  defaults.

## Impact

- Affects `scripts/codex-agent.sh`, `scripts/openspec/init-change-workspace.sh`,
  and `test/install.test.js`.
- Keeps the existing finish pipeline intact while making quota-hit/manual
  takeovers copy-pasteable instead of reconstructive.
