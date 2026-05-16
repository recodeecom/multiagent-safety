# Auto-prune stale agent worktrees on setup/doctor

## Why

When `gx branch finish --cleanup` fails mid-cleanup (lost network, killed process, crashed agent), the agent branch is deleted but the worktree under `.omc/agent-worktrees/` (or `.omx/agent-worktrees/`) is left stranded in a detached-HEAD state. Over time the repo accumulates dozens of these orphaned worktrees.

`scripts/agent-worktree-prune.sh` (invoked by `gx cleanup`) already knows how to remove these, but it only runs:

- manually via `gx cleanup`
- in the background daemon started by `gx agents start`

Neither `gx setup` nor `gx doctor` invokes it today — the existing `autoFinishReadyAgentBranches` sweep only handles agent branches that still exist locally with unmerged commits (`ahead > 0`). Branches already deleted post-merge with stranded worktrees are invisible to that sweep.

Observed on `agents-hivemind`: 9 stranded worktrees under `.omc/agent-worktrees/`, 7 of them in detached-HEAD state (branch gone, worktree orphaned). `gx setup` and `gx doctor` run and leave all 9 in place.

## What Changes

- Add `pruneStaleAgentWorktrees(repoRoot, options)` to `src/doctor/index.js`. It invokes the existing `worktreePrune` script with `--delete-branches --delete-remote-branches --include-pr-merged` and an idle-minutes safety threshold (default 60 — matches `gx agents start` cleanup daemon) so worktrees with activity within the last hour are preserved.
- Invoke the new helper at the tail of both `gx setup` and `gx doctor`, directly after the existing `autoFinishReadyAgentBranches` call. Each repo in recursive mode gets its own invocation.
- Honor the existing `--dry-run` flag (no destructive side-effects in dry-run).
- Add opt-out env var `GUARDEX_SKIP_AUTO_WORKTREE_PRUNE=1`, mirroring the existing `GUARDEX_SKIP_AUTO_FINISH_READY_BRANCHES=1` escape hatch.
- Skip pruning inside doctor sandbox passes (`GUARDEX_DOCTOR_SANDBOX=1`) to avoid recursion.
- Add doctor JSON output field `worktreePrune` alongside the existing `autoFinish` field.

## Impact

- Affected specs: `doctor/spec.md` (delta).
- Affected code: `src/doctor/index.js`, `src/cli/main.js`.
- Behavior change: `gx setup` and `gx doctor` now perform a non-dry, destructive worktree prune by default. Guarded by idle-minutes (60) so active agents are preserved, and opt-out env var for users who want the old behavior.
- No API or schema change.
