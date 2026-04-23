## 1. Spec

- [x] 1.1 Define the helper-worktree placement and stale-temp-branch cleanup requirements.
- [x] 1.2 Capture the scope in `proposal.md`.

## 2. Tests

- [x] 2.1 Update finish/worktree regressions for `.tmp-worktrees` helper paths and stale temp-ref cleanup.
- [x] 2.2 Update setup expectations for the expanded repo-scan ignore list.
- [x] 2.3 Add a PR-mode finish regression proving `--via-pr` skips `__integrate-*` helper creation.

## 3. Implementation

- [x] 3.1 Move temporary finish helper worktrees into runtime-scoped `.tmp-worktrees` roots.
- [x] 3.2 Delete temporary integration refs at finish exit and sweep stale helper refs in `gx cleanup`.
- [x] 3.3 Extend repo scan ignore settings for temporary helper roots.
- [x] 3.4 Skip temporary integration helper creation in explicit PR-only finish mode.

## 4. Verification

- [x] 4.1 Run focused tests for finish/prune/setup behavior.
- [x] 4.2 Run `openspec validate agent-codex-fix-temp-helper-worktree-cleanup-2026-04-23-11-56 --type change --strict`.
- [x] 4.3 Re-run focused finish regressions covering explicit PR mode after the helper-skip patch.

## 5. Cleanup

- [ ] 5.1 Run `gx branch finish --branch agent/codex/fix-temp-helper-worktree-cleanup-2026-04-23-11-56 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 5.2 Record PR URL + `MERGED` evidence.
- [ ] 5.3 Confirm sandbox worktree and temp refs are gone (`git worktree list`, `git branch -a`).
