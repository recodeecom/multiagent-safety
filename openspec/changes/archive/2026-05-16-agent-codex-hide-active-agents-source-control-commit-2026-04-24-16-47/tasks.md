## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

Handoff: 2026-04-24 16:47Z codex owns the Active Agents runtime/template extension files, focused VS Code tests, README parity, and this change workspace for hiding the custom SCM commit provider.

## 1. Specification

- [x] 1.1 Define acceptance criteria for removing the `Active Agents Commit` Source Control provider.
- [x] 1.2 Add normative requirements in `specs/vscode-active-agents-commit-affordance/spec.md`.

## 2. Implementation

- [x] 2.1 Remove the custom Active Agents SCM provider from the live extension and template copy.
- [x] 2.2 Keep selected-session commits available through the Active Agents toolbar with a focused commit-message prompt.
- [x] 2.3 Update README/template copy and focused regression tests.

## 3. Verification

- [x] 3.1 Run `node --test test/vscode-active-agents-session-state.test.js`. Result: 55/55 passing.
- [x] 3.2 Run `openspec validate agent-codex-hide-active-agents-source-control-commit-2026-04-24-16-47 --type change --strict`. Result: valid.
- [x] 3.3 Run `openspec validate --specs`. Result: command exited 0 with `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/hide-active-agents-source-control-commit-2026-04-24-16-47 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
