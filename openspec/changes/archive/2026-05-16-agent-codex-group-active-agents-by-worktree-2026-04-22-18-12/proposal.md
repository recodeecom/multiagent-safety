## Why

- The Active Agents companion already groups sessions by activity, but the tree still flattens sessions directly under those state buckets.
- The requested VS Code shape is worktree-first: users should be able to scan a worktree row and then expand to the agents running inside it.
- The current `CHANGES` grouping already knows ownership through `worktreePath` and `changedPaths`, so the missing behavior is tree presentation, not new runtime telemetry.

## What Changes

- Add a worktree row above agent rows inside `ACTIVE AGENTS`.
- Group `CHANGES` by worktree first, then by owning agent session, while leaving unmatched files in `Repo root`.
- Keep the existing debounced watcher model, session actions, lock decorations, and selected-session SCM commit flow unchanged.
- Mirror the tree-shape change in both shipped extension sources and focused regression tests.

## Impact

- Affected surfaces: `vscode/guardex-active-agents/extension.js`, `templates/vscode/guardex-active-agents/extension.js`, focused extension tests, and this OpenSpec change.
- Risk is limited to tree rendering and test expectations. No session-state schema or watcher lifecycle contract changes are required.
