## Why

- `scripts/agent-branch-finish.sh` currently treats `git branch -d <agent-branch>` as a hard cleanup failure even after the merge already succeeded.
- In the observed false-negative, `gh pr merge --delete-branch` reported that local branch deletion failed because of an active worktree, but by the time Guardex continued its own cleanup the local branch ref was already gone.
- That leaves the merge outcome correct but still exits non-zero, which forces needless manual bookkeeping follow-ups.

## What Changes

- Make finish cleanup tolerate an already-missing local source branch during the post-merge branch-delete step.
- Keep the existing warning for the GitHub CLI local-delete error, but continue cleanup when the branch ref has already disappeared.
- Add a focused finish regression for the race where the local branch is gone by the time Guardex reaches its own cleanup.

## Impact

- Affects only the post-merge cleanup path in `agent-branch-finish.sh`.
- Keeps true branch-delete failures fatal, but downgrades the already-deleted case to an informational cleanup warning.
- Reduces false-negative finish exits while preserving merge, remote-delete, and worktree-prune behavior.
