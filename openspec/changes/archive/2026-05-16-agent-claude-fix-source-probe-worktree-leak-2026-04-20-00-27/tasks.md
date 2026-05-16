## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-fix-source-probe-worktree-leak-2026-04-20-00-27`.
- [x] 1.2 Define normative requirements in `specs/fix-source-probe-worktree-leak/spec.md`.

## 2. Implementation

- [x] 2.1 Hoist cleanup trap before sync-guard block; add rebase/merge abort before `worktree remove --force`.
- [x] 2.2 Bump package.json 7.0.1 → 7.0.2 (patch: bug fix).

## 3. Verification

- [x] 3.1 `bash -n templates/scripts/agent-branch-finish.sh` (syntax OK).
- [x] 3.2 `node --test test/*.test.js` — no new regressions (18 pre-existing failures on `main`, same count after patch).
- [x] 3.3 `openspec validate agent-claude-fix-source-probe-worktree-leak-2026-04-20-00-27 --type change --strict` (run pre-finish).

## 4. Cleanup

- [x] 4.1 Run `scripts/agent-branch-finish.sh --branch agent/claude/fix-source-probe-worktree-leak-2026-04-20-00-27 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox worktree is removed (`git worktree list` shows no entry; `git branch -a` shows no surviving refs).
