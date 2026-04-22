## Definition of Done

This change is complete only when all of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks, add a `BLOCKED:` line under section 4 and stop.

## Handoff

- Handoff: change=`agent-codex-replace-custom-semver-jsonc-stdin-helper-2026-04-22-18-06`; branch=`agent/codex/replace-custom-semver-jsonc-stdin-helper-2026-04-22-18-06`; scope=`package.json`, `package-lock.json`, `src/core/**`, `src/toolchain/index.js`, `src/cli/main.js`, `src/scaffold/index.js`, and targeted tests; action=`replace the remaining custom semver/jsonc/stdin helpers with shared, standards-based implementations without changing CLI behavior`.

## 1. Specification

- [x] 1.1 Capture the bounded cleanup scope and acceptance criteria for the semver/jsonc/stdin helper replacement.
- [x] 1.2 Add a `cli-modularization` spec delta that keeps version/stdin helper ownership single-sourced and JSONC parsing standards-based.

## 2. Implementation

- [x] 2.1 Add focused regression coverage for prerelease version ordering, multi-byte stdin reads, and JSONC parsing before deleting the custom helper code.
- [x] 2.2 Add shared core helpers for semver comparison and stdin line reading, then route `src/toolchain/index.js` and `src/cli/main.js` through them.
- [x] 2.3 Replace the custom JSONC stripping/parsing code in `src/scaffold/index.js` with `jsonc-parser`.
- [x] 2.4 Remove the now-duplicated local helper implementations from `src/cli/main.js` and `src/toolchain/index.js`.

## 3. Verification

- [x] 3.1 Run `node --check src/core/versions.js src/core/stdin.js src/toolchain/index.js src/scaffold/index.js src/cli/main.js`.
- [x] 3.2 Run targeted tests for the touched surfaces (`node --test test/status.test.js test/release.test.js test/setup.test.js test/core-version.test.js test/core-stdin.test.js test/scaffold-jsonc.test.js`).
- [x] 3.3 Run `npm test`.
- [x] 3.4 Run `openspec validate agent-codex-replace-custom-semver-jsonc-stdin-helper-2026-04-22-18-06 --type change --strict`.
- [x] 3.5 Run `openspec validate --specs`.

## 4. Cleanup

- [x] 4.1 Run `gx branch finish --branch agent/codex/replace-custom-semver-jsonc-stdin-helper-2026-04-22-18-06 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is removed and no local/remote refs remain for the branch.
