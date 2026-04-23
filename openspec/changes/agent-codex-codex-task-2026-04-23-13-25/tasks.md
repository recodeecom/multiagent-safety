## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-codex-task-2026-04-23-13-25`; branch=`agent/codex/codex-task-2026-04-23-13-25`; scope=`Active Agents raw worktree labels, compact branch rows, mirrored template, focused tests`; action=`improve the screenshoted tree design inside the existing sandbox and finish normally`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-codex-task-2026-04-23-13-25`.
- [x] 1.2 Define normative requirements in `specs/agent-codex-codex-task-2026-04-23-13-25/spec.md`.

## 2. Implementation

- [x] 2.1 Tighten raw Active Agents worktree labels/descriptions to read task-first instead of machine-folder-first.
- [x] 2.2 Tighten raw branch row labels/descriptions to show compact owner/task labels and cleaner `3 files` wording.
- [x] 2.3 Mirror the tree update into the template extension source and bump the live/template manifest versions.
- [x] 2.4 Extend focused regression coverage for the raw tree presentation.

## 3. Verification

- [x] 3.1 Run `node --test test/vscode-active-agents-session-state.test.js`.
- [x] 3.2 Run `openspec validate agent-codex-codex-task-2026-04-23-13-25 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/codex-task-2026-04-23-13-25 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
