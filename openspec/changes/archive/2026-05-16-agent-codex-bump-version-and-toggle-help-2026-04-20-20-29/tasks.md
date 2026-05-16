## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-bump-version-and-toggle-help-2026-04-20-20-29`.
- [x] 1.2 Define normative requirements in `specs/release-version-bump/spec.md`.

## 2. Implementation

- [x] 2.1 Bump package metadata and release notes to `7.0.8`.
- [x] 2.2 Keep the `REPO TOGGLE` / `GUARDEX_ON=0|1` guidance represented in the release notes for this publishable release.

## 3. Verification

- [x] 3.1 Run targeted project verification commands (`node --test test/install.test.js`, `node --test test/metadata.test.js`, `node --check bin/multiagent-safety.js`, `NPM_CONFIG_CACHE=/tmp/guardex-npm-cache npm pack --dry-run`). Note: `npm test` still hits the pre-existing `test/frontend-how-it-works.test.js` failure, and it reproduces on clean `main` at `7.0.7`.
- [x] 3.2 Run `openspec validate agent-codex-bump-version-and-toggle-help-2026-04-20-20-29 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Completion

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
