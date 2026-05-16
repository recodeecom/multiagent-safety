## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-handle-codex-file-path-and-early-gitigno-2026-04-21-10-35`.
- [x] 1.2 Define normative requirements in `specs/codex-path-conflict-bootstrap/spec.md`.

## 2. Implementation

- [x] 2.1 Patch installer path handling so `.codex` file conflicts fail with a readable Guardex error.
- [x] 2.2 Move managed `.gitignore` creation earlier in setup/doctor bootstrap.
- [x] 2.3 Add regression coverage for `.codex`-as-file setup/doctor failures.

## 3. Verification

- [x] 3.1 Run targeted `node --test test/install.test.js` coverage for the new repo bootstrap case.
- [x] 3.2 Run `openspec validate agent-codex-handle-codex-file-path-and-early-gitigno-2026-04-21-10-35 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup

- [x] 4.1 Run `bash scripts/agent-branch-finish.sh --branch agent/codex/handle-codex-file-path-and-early-gitigno-2026-04-21-10-35 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL and final merge state.
- [x] 4.3 Confirm sandbox worktree and refs are cleaned up.
