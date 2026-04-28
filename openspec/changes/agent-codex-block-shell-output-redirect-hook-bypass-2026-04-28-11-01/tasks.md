## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-block-shell-output-redirect-hook-bypass-2026-04-28-11-01`; branch=`agent/codex/block-shell-output-redirect-hook-bypass-2026-04-28-11-01`; scope=`hook guard shell output redirection bypass`; action=`completed and merged via PR #446`; evidence=`https://github.com/recodeee/gitguardex/pull/446`, state=`MERGED`, merge_commit=`f885a248b583c0710cb0684aceae3e7c13904433`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-block-shell-output-redirect-hook-bypass-2026-04-28-11-01`.
- [x] 1.2 Define normative requirements in `specs/hook-guardrails/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands. Evidence: `python3 -m py_compile .codex/hooks/skill_guard.py .claude/hooks/skill_guard.py`; `node --test --test-name-pattern "repo hook settings reference real local hook directories|repo skill guard blocks shell output redirect bypasses" test/setup.test.js` -> 2 passed.
- [x] 3.2 Run `openspec validate agent-codex-block-shell-output-redirect-hook-bypass-2026-04-28-11-01 --type change --strict`. Evidence: valid.
- [x] 3.3 Run `openspec validate --specs`. Evidence: no spec items found.

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/block-shell-output-redirect-hook-bypass-2026-04-28-11-01 --base main --via-pr --wait-for-merge --cleanup`. Evidence: completed with exit 0 and merged PR #446.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff. Evidence: `gh pr view agent/codex/block-shell-output-redirect-hook-bypass-2026-04-28-11-01 --repo recodeee/gitguardex --json number,url,state,mergedAt,headRefName,baseRefName,mergeCommit` -> `https://github.com/recodeee/gitguardex/pull/446`, `MERGED`, `mergedAt=2026-04-28T09:13:19Z`, `mergeCommit=f885a248b583c0710cb0684aceae3e7c13904433`.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch). Evidence: `git worktree list --porcelain` no longer lists `.omx/agent-worktrees/gitguardex__codex__block-shell-output-redirect-hook-bypass-2026-04-28-11-01`; `git fetch --prune origin` pruned `origin/agent/codex/block-shell-output-redirect-hook-bypass-2026-04-28-11-01`.
