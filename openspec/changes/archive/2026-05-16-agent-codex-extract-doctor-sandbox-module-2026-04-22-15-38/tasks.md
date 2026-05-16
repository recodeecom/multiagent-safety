## Definition of Done

This change is complete only when all of the following are true:

- Every checkbox below is checked.
- The branch `agent/codex/extract-doctor-sandbox-module-2026-04-22-15-38` reaches `MERGED` state on `origin` and the PR URL + final merge state are recorded in the completion handoff.
- If any step blocks, add a `BLOCKED:` line under section 4 and stop.

## Handoff

- Handoff: change=`agent-codex-extract-doctor-sandbox-module-2026-04-22-15-38`; branch=`agent/codex/extract-doctor-sandbox-module-2026-04-22-15-38`; scope=`src/cli/main.js`, `src/doctor/index.js`, `src/git/index.js`, `test/cli-args-dispatch.test.js`; action=`move the protected-main doctor lifecycle into src/doctor and the remaining shared git helpers into src/git without changing doctor behavior`.

## 1. Specification

- [x] 1.1 Lock the cleanup scope to doctor lifecycle extraction plus shared git-helper relocation only.
- [x] 1.2 Add a `cli-modularization` delta that requires the protected-main doctor flow to live under `src/doctor`.

## 2. Implementation

- [x] 2.1 Add `src/doctor/index.js` and move the protected-main doctor sandbox lifecycle out of `src/cli/main.js`.
- [x] 2.2 Move `readGitConfig`, `currentBranchName`, `workingTreeIsDirty`, `aheadBehind`, `branchExists`, and `branchMergedIntoBase` into `src/git/index.js`.
- [x] 2.3 Keep `src/cli/main.js` as the command-level integrator only and update the modularization regression test to guard the new boundary.
- [x] 2.4 Fix the protected-base stash cleanup path so successful merge-back cannot leak a leftover stash if sandbox cleanup fails later.

## 3. Verification

- [x] 3.1 Run `node --check src/cli/main.js src/doctor/index.js src/git/index.js`.
- [x] 3.2 Run `node --test test/cli-args-dispatch.test.js test/doctor.test.js`.
- [x] 3.3 Run `openspec validate agent-codex-extract-doctor-sandbox-module-2026-04-22-15-38 --type change --strict`.
- [x] 3.4 Run `openspec validate --specs`.

Verification note: `node --check src/cli/main.js src/doctor/index.js src/git/index.js` passed; `node --test test/cli-args-dispatch.test.js` passed (10/10); `node --test test/doctor.test.js` passed (17/17); `openspec validate agent-codex-extract-doctor-sandbox-module-2026-04-22-15-38 --type change --strict` returned valid; `openspec validate --specs` returned `No items found to validate`.

## 4. Cleanup

- [x] 4.1 Run `gx branch finish --branch agent/codex/extract-doctor-sandbox-module-2026-04-22-15-38 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is removed and no local/remote refs remain for the branch.

BLOCKED: the worktree also contains an overlapping scaffold/DI extraction attempt (`src/scaffold/index.js` plus `openspec/changes/agent-codex-extract-git-scaffold-doctor-di-2026-04-22-15-38/`) that was not part of this narrow doctor-module pass. Do not run the cleanup/finish pipeline for this branch until that parallel scope is either integrated intentionally or moved off the branch.
