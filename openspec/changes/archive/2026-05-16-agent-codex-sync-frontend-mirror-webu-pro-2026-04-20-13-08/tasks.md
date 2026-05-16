## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for frontend mirror sync.
- [x] 1.2 Define normative requirements in `specs/frontend-mirror-sync/spec.md`.

## 2. Implementation

- [x] 2.1 Add subtree sync helper script for `frontend/` -> target repo branch push.
- [x] 2.2 Add GitHub Actions workflow to run sync on `main` pushes that touch `frontend/**` and on manual dispatch.
- [x] 2.3 Document setup requirements (secret + optional vars) and operator runbook in `README.md`.

## 3. Verification

- [x] 3.1 Run shell syntax checks for modified script/workflow support files.
- [x] 3.2 Run `npm test`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup

- [x] 4.1 Confirm task checklist reflects implemented state and known limitations.
- [x] 4.2 Merge the branch and clean up worktree/branch per repo policy.
