## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-improve-active-agents-extension-runtime-2026-04-22-16-55`; branch=`agent/codex/improve-active-agents-extension-runtime-2026-04-22-16-55`; scope=`active-session heartbeat writer, Active Agents tree runtime signals, repo-root changes filtering, lock conflict/context keys, mirrored extension sources/tests/docs`; action=`implement the delta-only runtime gaps, verify focused tests/specs, then finish via PR merge cleanup`.
- Copy prompt: Continue `agent-codex-improve-active-agents-extension-runtime-2026-04-22-16-55` on branch `agent/codex/improve-active-agents-extension-runtime-2026-04-22-16-55`. Work inside the existing sandbox, review `openspec/changes/agent-codex-improve-active-agents-extension-runtime-2026-04-22-16-55/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/improve-active-agents-extension-runtime-2026-04-22-16-55 --base main --via-pr --wait-for-merge --cleanup`.
- Join handoff: resumed the existing sandbox, validated the current heartbeat/runtime diff against proposal + spec, ran focused verification, and will finish via PR merge cleanup from this same lane.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-improve-active-agents-extension-runtime-2026-04-22-16-55`.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-extension/spec.md`.

## 2. Implementation

- [x] 2.1 Add active-session heartbeat schema/writer support and `gx internal heartbeat --branch <branch>`.
- [x] 2.2 Keep Codex wrapper session records fresh while the sandbox process runs.
- [x] 2.3 Filter repo-root `CHANGES` to exclude managed worktrees/session state and add per-session touched-file rows.
- [x] 2.4 Surface lock conflicts and update `guardex.hasAgents` / `guardex.hasConflicts` context keys.
- [x] 2.5 Reconcile `vscode/guardex-active-agents/*` with `templates/vscode/guardex-active-agents/*` and update docs.
- [x] 2.6 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-improve-active-agents-extension-runtime-2026-04-22-16-55 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/improve-active-agents-extension-runtime-2026-04-22-16-55 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
