# Proposal: fix temp helper worktree cleanup

## Why

- `gx branch finish` creates `__source-probe-*` and `__integrate-*` helper worktrees under `.omx/agent-worktrees` / `.omc/agent-worktrees`, so VS Code surfaces them beside real agent lanes.
- The finish flow removes temporary integration worktrees but can still leave stale `__agent_integrate_*` refs behind, which stacks up noisy helper branches after repeated doctor/finish runs.
- Repo-level Git scan ignores currently cover only durable agent worktree roots, so moving helper worktrees into a dedicated internal temp root also needs settings parity.
- Even after moving helpers under `.tmp-worktrees`, `gx branch finish --via-pr` still creates a throwaway `__integrate-*` worktree before it falls into the PR path. That keeps opening noisy temporary repos in Source Control even when direct integration is intentionally disabled.

## What changes

- Move temporary finish helpers into `.omx/.tmp-worktrees` and `.omc/.tmp-worktrees` instead of the user-visible agent worktree roots.
- Delete temporary integration refs directly during finish cleanup and sweep any older stale temp refs in `gx cleanup`.
- Extend managed VS Code repo-scan ignores and focused regressions for the new temp-helper placement and stale-temp-branch cleanup.
- Skip creating `__integrate-*` helper worktrees entirely when finish runs in explicit PR-only mode (`--mode pr` / `--via-pr`) and prove it with a focused regression.

## Scope

- Affected runtime/scripts: `scripts/agent-branch-finish.sh`, `scripts/agent-worktree-prune.sh`
- Affected template mirrors: `templates/scripts/*`
- Affected config/test surface: `src/context.js`, `test/finish.test.js`, `test/worktree.test.js`, `test/setup.test.js`
- Follow-up runtime/scripts in this extension: `scripts/agent-branch-finish.sh`, `templates/scripts/agent-branch-finish.sh`
