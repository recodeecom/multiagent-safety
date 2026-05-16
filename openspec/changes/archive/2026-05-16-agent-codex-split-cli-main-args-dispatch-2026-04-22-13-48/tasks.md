## Definition of Done

This change is complete only when all of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks, add a `BLOCKED:` line under section 4 and stop.

## Handoff

- Handoff: change=`agent-codex-split-cli-main-args-dispatch-2026-04-22-13-48`; branch=`agent/codex/split-cli-main-args-dispatch-2026-04-22-13-48`; scope=`src/cli/main.js`, `src/cli/args.js`, `src/cli/dispatch.js`, `src/git/index.js`, `test/cli-args-dispatch.test.js`; action=`delete duplicate helper definitions from src/cli/main.js and keep extracted seams single-sourced`.

## 1. Specification

- [x] 1.1 Capture follow-up cleanup scope and acceptance criteria for the extracted CLI helper seams.
- [x] 1.2 Add a spec delta for single-source helper ownership under `cli-modularization`.

## 2. Implementation

- [x] 2.1 Remove duplicate parser helper definitions from `src/cli/main.js` and use `src/cli/args.js`.
- [x] 2.2 Remove duplicate git helper definitions from `src/cli/main.js` and use `src/git/index.js`.
- [x] 2.3 Remove duplicate dispatch helper definitions from `src/cli/main.js` and use `src/cli/dispatch.js`.

## 3. Verification

- [x] 3.1 Add/update focused regression coverage for extracted args/dispatch delegation.
- [x] 3.2 Run `node --check src/cli/main.js src/cli/args.js src/cli/dispatch.js src/git/index.js`.
- [x] 3.3 Run focused CLI regression suites covering the extracted helper seams.
- [x] 3.4 Run `openspec validate agent-codex-split-cli-main-args-dispatch-2026-04-22-13-48 --type change --strict`.
- [x] 3.5 Run `openspec validate --specs`.

Verification note: `node --test test/cli-args-dispatch.test.js`, `node --test test/metadata.test.js`, `node --test test/setup.test.js`, `node --test test/doctor.test.js`, and `npm test` all passed after removing the remaining local parser/dispatch copies from `src/cli/main.js`. `openspec validate --specs` exited `0` with `No items found to validate` in this repo.

## 4. Cleanup

- [x] 4.1 Run `gx branch finish --branch agent/codex/split-cli-main-args-dispatch-2026-04-22-13-48 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is removed and no local/remote refs remain for the branch.
