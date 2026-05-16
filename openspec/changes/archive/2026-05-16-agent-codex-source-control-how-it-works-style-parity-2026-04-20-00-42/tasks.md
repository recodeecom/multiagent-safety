## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-source-control-how-it-works-style-parity-2026-04-20-00-42`.
- [x] 1.2 Define normative requirements in `specs/source-control-how-it-works-style-parity/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-source-control-how-it-works-style-parity-2026-04-20-00-42 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup

- [x] 4.1 Run `bash scripts/agent-branch-finish.sh --branch agent/codex/source-control-how-it-works-style-parity-2026-04-20-00-42 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL and final merge state.
- [x] 4.3 Confirm sandbox worktree and refs are cleaned up.
