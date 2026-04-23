## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

Handoff: 2026-04-23 12:29Z codex owns `vscode/guardex-active-agents/*`, `templates/vscode/guardex-active-agents/*`, `test/vscode-active-agents-session-state.test.js`, and this change workspace to ship a task-first Active Agents panel layout for dense multi-agent repo triage.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-active-agents-task-first-layout-2026-04-23-12-29`.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-task-first-layout/spec.md`.

## 2. Implementation

- [x] 2.1 Replace the default repo tree with task-first operator sections for overview, working now, idle / thinking, unassigned changes, and advanced details.
- [x] 2.2 Render session rows as compact task cards with task title, agent, state, file/lock counts, freshness, recent-change detail, and inline risk summaries.
- [x] 2.3 Keep raw path/tree detail behind collapsed advanced disclosure and update the focused tests plus mirrored template sources.
- [x] 2.4 Bump the live/template Active Agents manifest versions for the new shipped layout.

## 3. Verification

- [x] 3.1 Run `node --test test/vscode-active-agents-session-state.test.js`.
- [x] 3.2 Run `openspec validate agent-codex-active-agents-task-first-layout-2026-04-23-12-29 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup

- [x] 4.1 Run `gx branch finish --branch "agent/codex/active-agents-task-first-layout-2026-04-23-12-29" --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).

Completion handoff: 2026-04-23 11:12Z PR https://github.com/recodeee/gitguardex/pull/366 reached `MERGED` (`gh pr view 366 --json number,url,state,mergedAt,headRefName,baseRefName`). `gx branch finish --branch "agent/codex/active-agents-task-first-layout-2026-04-23-12-29" --base main --via-pr --wait-for-merge --cleanup` exited 0. `git fetch --prune origin` removed `origin/agent/codex/active-agents-task-first-layout-2026-04-23-12-29`; `git branch -a --list "*active-agents-task-first-layout*"` returned no refs; `git worktree list` no longer showed the source sandbox.
