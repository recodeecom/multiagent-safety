## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18`; branch=`agent/codex/record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18`; scope=`openspec/changes/agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05/tasks.md plus helper change docs`; action=`record the already-completed merge and cleanup evidence for PR #318, verify the refs/worktree are gone, then finish this helper lane on main`.
- Copy prompt: Continue `agent-codex-record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18` on branch `agent/codex/record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18`. Work inside the existing sandbox, review `openspec/changes/agent-codex-record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18`.
- [x] 1.2 Define normative requirements in `specs/record-merged-cleanup-evidence-for-gx-prompt-parts/spec.md`.

## 2. Implementation

- [x] 2.1 Update the merged `agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05/tasks.md` cleanup section with the actual PR, merge, and cleanup evidence.
- [x] 2.2 Keep the helper change docs aligned with the cleanup-evidence update.

## 3. Verification

- [x] 3.1 Verify PR `#318` merge state plus the absence of the original worktree and branch refs. Verified with `gh pr view 318 --json number,url,state,mergedAt,headRefName,baseRefName`, `git worktree list`, and `git branch -a | rg "agent/codex/improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05" -n` (no remaining refs).
- [x] 3.2 Run `openspec validate agent-codex-record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18 --type change --strict`. Passed on `2026-04-22`.
- [x] 3.3 Run `openspec validate --specs`. Passed on `2026-04-22` with `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/record-merged-cleanup-evidence-for-gx-pr-2026-04-22-16-18 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
