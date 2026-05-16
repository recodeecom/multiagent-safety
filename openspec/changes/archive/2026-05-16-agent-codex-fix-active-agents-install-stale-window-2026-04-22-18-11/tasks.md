## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-fix-active-agents-install-stale-window-2026-04-22-18-11`; branch=`agent/codex/fix-active-agents-install-stale-window-2026-04-22-18-11`; scope=`canonical Active Agents install path plus recent patch-path compatibility copies and reload wording`; action=`patch the installer/tests in this sandbox, verify, then finish cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-fix-active-agents-install-stale-window-2026-04-22-18-11`.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-extension/spec.md`.

## 2. Implementation

- [x] 2.1 Implement the canonical install path and compatibility copy behavior.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-fix-active-agents-install-stale-window-2026-04-22-18-11 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

Verification note:
- `node --test test/vscode-active-agents-session-state.test.js test/metadata.test.js` passed `55/55`.
- `openspec validate agent-codex-fix-active-agents-install-stale-window-2026-04-22-18-11 --type change --strict` returned `Change 'agent-codex-fix-active-agents-install-stale-window-2026-04-22-18-11' is valid`.
- `openspec validate --specs` returned `No items found to validate.` in this repo state.

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/fix-active-agents-install-stale-window-2026-04-22-18-11 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
