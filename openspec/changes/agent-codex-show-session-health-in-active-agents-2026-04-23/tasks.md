## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-show-session-health-in-active-agents-2026-04-23`; branch=`agent/codex/codex-task-2026-04-23-13-25`; scope=`vscode/guardex-active-agents/*`, `templates/vscode/guardex-active-agents/*`, `test/vscode-active-agents-session-state.test.js`, and this change workspace; action=`render optional Cave Monitor session-health scores in Active Agents rows without changing no-payload sessions`.
- Copy prompt: Continue `agent-codex-show-session-health-in-active-agents-2026-04-23` on branch `agent/codex/codex-task-2026-04-23-13-25`. Work inside the existing sandbox, review `openspec/changes/agent-codex-show-session-health-in-active-agents-2026-04-23/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/codex-task-2026-04-23-13-25 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-show-session-health-in-active-agents-2026-04-23`.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-session-health/spec.md`.

## 2. Implementation

- [x] 2.1 Normalize optional `sessionHealth` payloads from active-session JSON records and `AGENT.lock` snapshot telemetry.
- [x] 2.2 Render compact session-health scores in Active Agents rows, tooltips, and detail items without changing sessions that lack health data.
- [x] 2.3 Mirror the source/template patch and add focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-show-session-health-in-active-agents-2026-04-23 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

Verification evidence:
- `node --test test/vscode-active-agents-session-state.test.js` (pass, 42 tests)
- `openspec validate agent-codex-show-session-health-in-active-agents-2026-04-23 --type change --strict` (pass)
- `openspec validate --specs` (`No items found to validate.` in this worktree)

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/codex-task-2026-04-23-13-25 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
