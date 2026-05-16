## Why

- Users need to preview `gx agents start` branch, worktree, and launch details before allowing Guardex to mutate the repo or start an agent process.

## What Changes

- Add a dry-run-only task start path for `gx agents start <task> --agent <id> [--base <branch>] --dry-run`.
- Validate known agent ids, derive the task slug, branch, worktree path, and launch command, then print the plan without creating runtime state.

## Impact

- Scope is limited to dry-run behavior. Existing no-task `gx agents start` review/cleanup bot behavior stays unchanged.
