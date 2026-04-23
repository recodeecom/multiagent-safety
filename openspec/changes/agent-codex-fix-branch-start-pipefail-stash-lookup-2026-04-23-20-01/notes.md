# agent-codex-fix-branch-start-pipefail-stash-lookup-2026-04-23-20-01 (minimal / T1)

Branch: `agent/codex/fix-branch-start-pipefail-stash-lookup-2026-04-23-20-01`

Protected-branch auto-transfer can misread the new stash ref under `set -o pipefail` because the `git stash list | awk ... exit` pipeline exits early once `awk` finds the matching message. Resolve the ref by reading the stash list once into a helper and matching there so `gx branch start` keeps moving local changes into the new agent worktree without tripping the pipefail path.

Scope:
- Add `resolve_stash_ref_by_message` to `scripts/agent-branch-start.sh`, `templates/scripts/agent-branch-start.sh`, and `frontend/scripts/agent-branch-start.sh` so all shipped copies use the same safe stash lookup.
- Replace the inline `git stash list | awk ... exit` lookup with the shared helper on the protected-branch auto-transfer path.
- Add focused regression coverage in `test/branch.test.js` that exercises the installed script path and proves the base checkout ends clean with no leftover `guardex-auto-transfer-*` stash entry.

Verification:
- `node --test test/branch.test.js`

## Handoff

- Handoff: change=`agent-codex-fix-branch-start-pipefail-stash-lookup-2026-04-23-20-01`; branch=`agent/codex/fix-branch-start-pipefail-stash-lookup-2026-04-23-20-01`; scope=`scripts/agent-branch-start.sh, templates/scripts/agent-branch-start.sh, frontend/scripts/agent-branch-start.sh, test/branch.test.js, openspec/changes/agent-codex-fix-branch-start-pipefail-stash-lookup-2026-04-23-20-01/*`; action=`land the pipefail-safe stash lookup fix, verify with focused branch tests, then finish via PR merge + cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/fix-branch-start-pipefail-stash-lookup-2026-04-23-20-01 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
