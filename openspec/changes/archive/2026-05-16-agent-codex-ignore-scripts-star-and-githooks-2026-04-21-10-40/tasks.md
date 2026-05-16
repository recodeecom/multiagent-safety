## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-ignore-scripts-star-and-githooks-2026-04-21-10-40`.
- [x] 1.2 Define normative requirements in `specs/ignore-scripts-star-and-githooks/spec.md`.

## 2. Implementation

- [x] 2.1 Replace per-file script entries in `MANAGED_GITIGNORE_PATHS` with `scripts/*`.
- [x] 2.2 Replace per-file hook entries in `MANAGED_GITIGNORE_PATHS` with `.githooks`.
- [x] 2.3 Keep doctor sandbox auto-finish on the current protected base branch so main-only repos do not fall back to `dev`.
- [x] 2.4 Update setup and doctor regressions in `test/install.test.js` to pin the wildcard-managed entries and `AGENTS.md` restoration.
- [x] 2.5 Confirm no version bump is needed because the repo is already on `7.0.13`.

## 3. Verification

- [x] 3.1 `node --check bin/multiagent-safety.js`
- [x] 3.2 Focused `node --test` coverage for the affected setup/doctor cases.
- [x] 3.3 `openspec validate agent-codex-ignore-scripts-star-and-githooks-2026-04-21-10-40 --type change --strict`

## 4. Cleanup

- [x] 4.1 Finish the agent branch via PR merge + cleanup after verification.
