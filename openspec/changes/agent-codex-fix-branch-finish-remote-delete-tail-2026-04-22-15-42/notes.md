# agent-codex-fix-branch-finish-remote-delete-tail-2026-04-22-15-42 (minimal / T1)

Branch: `agent/codex/fix-branch-finish-remote-delete-tail-2026-04-22-15-42`

`gx branch finish --via-pr --wait-for-merge --cleanup` can succeed in merging a PR, delete the local agent branch, and still exit non-zero if the trailing `git push origin --delete <branch>` races with a branch that is already gone on the remote. The merge is already done at that point, so the cleanup tail should be idempotent.

Scope:
- Treat `remote ref does not exist` during the explicit remote-delete tail as a successful already-cleaned state.
- Keep real remote-delete failures strict instead of masking them with a blanket ignore.
- Add a focused finish regression that simulates the race after a successful PR merge.

Verification:
- `bash -n scripts/agent-branch-finish.sh templates/scripts/agent-branch-finish.sh`
- `node --test test/finish.test.js`

## Cleanup

- [ ] Run `gx branch finish --branch agent/codex/fix-branch-finish-remote-delete-tail-2026-04-22-15-42 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
