## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-group-active-agents-by-worktree-2026-04-22-18-12`; branch=`agent/codex/group-active-agents-by-worktree-2026-04-22-18-12`; scope=`worktree-first Active Agents tree grouping in live/template extension copies plus focused regression coverage`; action=`add worktree rows above agent rows, verify focused tests/specs, then finish via PR merge cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-group-active-agents-by-worktree-2026-04-22-18-12`.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-extension/spec.md`.

## 2. Implementation

- [x] 2.1 Add a worktree tree item and regroup `ACTIVE AGENTS` by `worktreePath` before agent/session rows.
- [x] 2.2 Regroup `CHANGES` by worktree first, then by owning session, while keeping unmatched files in `Repo root`.
- [x] 2.3 Mirror the tree-shape change in `templates/vscode/guardex-active-agents/extension.js`.
- [x] 2.4 Add/update focused regression coverage for the new tree shape.

## 3. Verification

- [x] 3.1 Run `node --test test/vscode-active-agents-session-state.test.js`.
- [x] 3.2 Run `openspec validate agent-codex-group-active-agents-by-worktree-2026-04-22-18-12 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run `gx branch finish --branch agent/codex/group-active-agents-by-worktree-2026-04-22-18-12 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
