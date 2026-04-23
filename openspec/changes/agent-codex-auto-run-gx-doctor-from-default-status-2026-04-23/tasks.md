## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-auto-run-gx-doctor-from-default-status-2026-04-23`; branch=`agent/codex/takeover-task-30ac51386203-2026-04-23-20-52`; scope=`src/cli/main.js`, `src/output/index.js`, `test/status.test.js`; action=`ship bare-gx auto-doctor with friendlier degraded UX, then verify and finish`.
- Copy prompt: Continue `agent-codex-auto-run-gx-doctor-from-default-status-2026-04-23` on branch `agent/codex/takeover-task-30ac51386203-2026-04-23-20-52`. Work inside the existing sandbox, review `openspec/changes/agent-codex-auto-run-gx-doctor-from-default-status-2026-04-23/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/takeover-task-30ac51386203-2026-04-23-20-52 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-auto-run-gx-doctor-from-default-status-2026-04-23`.
- [x] 1.2 Define normative requirements in `specs/doctor-workflow/spec.md`.

## 2. Implementation

- [x] 2.1 Let bare `gx` auto-run `gx doctor` when degraded and auto-repair is enabled for the session.
- [x] 2.2 Make degraded status output point humans at `gx doctor` and add a lightweight doctor handoff spinner.
- [x] 2.3 Add/update focused regression coverage for status-only and auto-doctor default invocation paths.

## 3. Verification

- [x] 3.1 Run targeted project verification commands (`node --test test/status.test.js`, `node --test test/doctor.test.js` if touched, `node --check bin/multiagent-safety.js` if needed).
- [x] 3.2 Run `openspec validate agent-codex-auto-run-gx-doctor-from-default-status-2026-04-23 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

Verification note: `node --test test/status.test.js` passed with 17/17 tests, including the new non-interactive status-only degraded path and `GUARDEX_AUTO_DOCTOR=yes` bare-`gx` auto-repair path. `node --check bin/multiagent-safety.js` passed. `openspec validate agent-codex-auto-run-gx-doctor-from-default-status-2026-04-23 --type change --strict` passed, and `openspec validate --specs` returned `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/takeover-task-30ac51386203-2026-04-23-20-52 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
