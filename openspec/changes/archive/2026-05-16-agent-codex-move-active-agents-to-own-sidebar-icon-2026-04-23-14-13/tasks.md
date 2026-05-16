## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

Handoff: 2026-04-23 14:20Z codex owns the Active Agents live/template manifests, runtime focus text, hive icon assets, focused tests/docs, and this change workspace for the new sidebar container move.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-move-active-agents-to-own-sidebar-icon-2026-04-23-14-13`.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-sidebar-icon/spec.md`.

## 2. Implementation

- [x] 2.1 Move the Active Agents view from the SCM container into a dedicated Activity Bar container with a hive icon.
- [x] 2.2 Preserve the live badge count on the new container and update focus/welcome/docs copy to match the new location.
- [x] 2.3 Add/update focused regression coverage plus mirrored template parity.

## 3. Verification

- [x] 3.1 Run `node --test test/vscode-active-agents-session-state.test.js`.
- [x] 3.2 Run `openspec validate agent-codex-move-active-agents-to-own-sidebar-icon-2026-04-23-14-13 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`. Result: command exited 0 with `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/move-active-agents-to-own-sidebar-icon-2026-04-23-14-13 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
