## Why

`agent-branch-finish.sh` creates a throwaway `__source-probe-*` worktree when the agent branch has no live worktree (needed for sync-guard rebase). The cleanup trap that removes it is registered *after* the sync-guard rebase block. When the rebase hits a conflict and `exit 1` fires, the trap is never armed, so the probe leaks. `gx doctor` sweeps that hit conflicts on stalled branches accumulate a new probe per run.

## What Changes

- Hoist the `cleanup()` function and `trap cleanup EXIT` to run *before* the sync-guard block (right after probe creation slot).
- In cleanup, abort any in-progress `rebase` / `merge` in the probe so `worktree remove --force` succeeds on conflict-stuck probes.
- Bump package version 7.0.1 → 7.0.2 (patch: bug fix).

## Impact

- Fixes leaked `__source-probe-*` directories across `gx doctor` / `agent-branch-finish` runs.
- No behavior change on the happy path — only the failure/conflict exit path gains cleanup.
- Users on 7.0.1 with accumulated probes will need a one-time manual sweep (`git worktree list | grep __source-probe` + remove).
