## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## 1. Specification

- [x] 1.1 Capture the live-worktree telemetry problem and acceptance criteria in this change.
- [x] 1.2 Define normative requirements for `AGENT.lock` fallback discovery in `specs/vscode-active-agents-extension/spec.md`.

## 2. Implementation

- [x] 2.1 Add a session-schema fallback that can synthesize live Active Agents rows from managed worktree `AGENT.lock` markers.
- [x] 2.2 Merge fallback worktree rows with existing `.omx/state/active-sessions/*.json` rows, preferring wrapper session data when both point at the same worktree.
- [x] 2.3 Refresh/watch the SCM companion on worktree-root `AGENT.lock` changes and keep current commit/change affordances working for synthetic rows.
- [x] 2.4 Update the extension README to describe the live worktree fallback.

## 3. Verification

- [x] 3.1 Run focused extension/session-state regression coverage.
- [x] 3.2 Run `openspec validate agent-codex-vscode-active-agents-live-worktree-telem-2026-04-22-13-43 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run `gx branch finish --branch agent/codex/vscode-active-agents-live-worktree-telem-2026-04-22-13-43 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
