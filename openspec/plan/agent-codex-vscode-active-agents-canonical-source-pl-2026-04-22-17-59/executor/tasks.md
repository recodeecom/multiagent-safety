# executor tasks

Handoff: change=`agent-codex-vscode-active-agents-canonical-source-pl-2026-04-22-17-59`; branch=`agent/codex/vscode-active-agents-canonical-source-im-2026-04-22-18-25`; scope=`src/context.js`, `src/scaffold/index.js`, `src/cli/main.js`, `test/metadata.test.js`, `test/setup.test.js`; action=`make the package repo root the canonical Active Agents source, materialize the template mirror from it, and verify with focused node tests plus OpenSpec validation`.
Focused verification: `node --test test/vscode-active-agents-session-state.test.js test/metadata.test.js test/setup.test.js`; `openspec validate agent-codex-vscode-active-agents-canonical-source-pl-2026-04-22-17-59 --type change --strict`; `openspec validate --specs`.
Finish command: `gx branch finish --branch agent/codex/vscode-active-agents-canonical-source-im-2026-04-22-18-25 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Spec

- [x] 1.1 Map the approved canonical-source requirements to concrete implementation work items.
- [x] 1.2 Freeze the touched components/files before coding starts: managed-file resolution, scaffold/doctor copy path, extension source tree, docs, and focused tests.

## 2. Tests

- [x] 2.1 Define test additions/updates required to lock canonical-source behavior, setup/doctor asset copying, and install payload truthfulness.
- [x] 2.2 Validate the focused regression and smoke verification commands before coding.

## 3. Implementation

- [x] 3.1 Move the authored extension source to one canonical tree and retire manual duplicate editing.
- [x] 3.2 Update setup/doctor/materialization so downstream repos still receive a working companion, including `icon.png`.
- [x] 3.3 Replace duplicate-tree parity plumbing with focused docs/tests and keep runtime behavior unchanged.

Verification note: `node --test test/vscode-active-agents-session-state.test.js test/metadata.test.js test/setup.test.js` passed (`97/97`); `openspec validate agent-codex-vscode-active-agents-canonical-source-pl-2026-04-22-17-59 --type change --strict` passed; `openspec validate --specs` exited `0` with `No items found to validate.`

## 4. Checkpoints

- [x] [E1] READY - Execution start checkpoint

### E1 Acceptance Criteria

- [x] The execution lane starts on a fresh implementation branch from `main`, not on the planning branch.
- [x] The touched-file list is frozen before code edits begin.
- [x] Runtime/UI behavior remains out of scope unless the canonical-source migration proves a blocker.

### E1 Verification Evidence

- [x] Executor notes record the frozen file list and branch choice.
- [x] `phases.md` is advanced to the execution phase when the fresh implementation lane begins.
- [x] The root handoff identifies the exact focused tests and finish command.

## 5. Collaboration

- [x] 5.1 Owner recorded the fresh implementation lane before edits.
- [x] 5.2 Record joined agents / handoffs, or mark `N/A` when solo.
Joined agents: `N/A` (solo lane).

## 6. Cleanup

- [ ] 6.1 Finish the implementation branch with `gx branch finish --branch <implementation-branch> --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 6.2 Record PR URL + final `MERGED` state in the handoff.
- [ ] 6.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or append `BLOCKED:` and stop.
