# Tasks

## 1. Spec

- [x] Record optional startup claim behavior for agent lane starts.

## 2. Tests

- [x] Add coverage for no claims, one claim, repeated claims, and claim failure recovery.
- [x] Keep legacy `gx agents start` repo-bot parser/behavior covered.

## 3. Implementation

- [x] Parse repeated `--claim` flags.
- [x] Run existing lock claiming after branch/worktree creation.
- [x] Write `claim-failed` session state and print recovery instructions on claim failure.

## 4. Cleanup

- [x] Focused verification: `node --test test/agents.test.js test/cli-args-dispatch.test.js test/agents-start-claims.test.js` -> 23/23 pass.
- [x] Finish via PR merge and sandbox cleanup.

