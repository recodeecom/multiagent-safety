## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-admin-recodee-com-recodee-compastor-how-it-works-nextjs-frontend-999465`.
- [x] 1.2 Define normative requirements in `specs/how-it-works-nextjs-frontend/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-admin-recodee-com-recodee-compastor-how-it-works-nextjs-frontend-999465 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## Notes

- `npm test` still reports an existing baseline failure in `test/metadata.test.js` (`critical runtime helper scripts stay in sync with templates`) because `scripts/codex-agent.sh` and `templates/scripts/codex-agent.sh` are already divergent in this branch baseline.
