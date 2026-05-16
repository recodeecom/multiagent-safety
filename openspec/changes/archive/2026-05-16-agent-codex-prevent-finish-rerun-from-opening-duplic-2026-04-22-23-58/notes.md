# agent-codex-prevent-finish-rerun-from-opening-duplic-2026-04-22-23-58 (minimal / T1)

Branch: `agent/codex/prevent-finish-rerun-from-opening-duplic-2026-04-22-23-58`

`gx branch finish --via-pr --wait-for-merge --cleanup` can reopen a fresh PR when the same source branch head already shipped in an earlier merged PR but the local branch/worktree cleanup was left behind. That turns a cleanup rerun into a new merge-wait loop instead of the bounded cleanup pass the user expected.

Scope:
- Before PR create/merge, detect whether the current source branch HEAD already matches a merged PR for the same branch/base pair.
- If that exact head already landed, skip new PR creation and continue straight to local cleanup while preserving merged PR context in the logs.
- Add a focused finish regression that fails if a rerun opens or merges a duplicate PR for an already-merged head.

Verification:
- `bash -n scripts/agent-branch-finish.sh templates/scripts/agent-branch-finish.sh`
- `node --test test/finish.test.js`

## Cleanup

- [x] Run `gx branch finish --branch agent/codex/prevent-finish-rerun-from-opening-duplic-2026-04-22-23-58 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
