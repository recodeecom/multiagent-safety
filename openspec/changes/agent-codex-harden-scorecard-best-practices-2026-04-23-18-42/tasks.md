## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-harden-scorecard-best-practices-2026-04-23-18-42`; branch=`agent/codex/harden-scorecard-best-practices-2026-04-23-18-42`; scope=`Scorecard-facing workflows, dependency metadata, and security/review docs`; action=`finish repo-side hardening, then apply and verify reachable GitHub settings`.
- Copy prompt: Continue `agent-codex-harden-scorecard-best-practices-2026-04-23-18-42` on branch `agent/codex/harden-scorecard-best-practices-2026-04-23-18-42`. Work inside the existing sandbox, review `openspec/changes/agent-codex-harden-scorecard-best-practices-2026-04-23-18-42/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/harden-scorecard-best-practices-2026-04-23-18-42 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-harden-scorecard-best-practices-2026-04-23-18-42`.
- [x] 1.2 Define normative requirements in `specs/harden-scorecard-best-practices/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-harden-scorecard-best-practices-2026-04-23-18-42 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup (mandatory; run before claiming completion)

- Cleanup result: PR [#392](https://github.com/recodeee/gitguardex/pull/392) is `MERGED` with merge commit `f0ee72a10b676508e21def6bc9a953522d80da22`; `gh pr view 392`, `git worktree list`, and `git branch -a` on `main` show the lane is closed and pruned.
- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/harden-scorecard-best-practices-2026-04-23-18-42 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
