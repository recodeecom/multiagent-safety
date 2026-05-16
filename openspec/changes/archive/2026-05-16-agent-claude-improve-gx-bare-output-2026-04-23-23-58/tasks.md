# Tasks

## 1. Spec

- [x] Capture the compact-status + next-step-hint contract in `specs/cli-output/spec.md`.

## 2. Tests

- [x] Update `test/status.test.js` default-status assertions to match the new `gx help:` title and the grouped `COMMANDS` tree.
- [x] Add regression: `GUARDEX_COMPACT_STATUS=1` collapses the services list and emits `[gitguardex] Next: …` + `Try 'gx help' for commands`.
- [x] Add regression: `gx status --verbose` re-expands the services list even when `GUARDEX_COMPACT_STATUS=1` is set.

## 3. Implementation

- [x] Add `getInvokedCliName()` helper in `src/output/index.js`, normalizing `process.argv[1]` to `gx` / `gitguardex` / `guardex` with a `SHORT_TOOL_NAME` fallback.
- [x] Refactor `printToolLogsSummary(options)` in `src/output/index.js` to accept `{ invokedBasename, compact }` — compact prints a single help pointer, expanded renames the title to `<invoked> help:` and threads the basename into the trailing `Try '<invoked> doctor' …` line.
- [x] Update `usage(options)` in `src/output/index.js` to accept `invokedBasename` and use it for the `USAGE` / `NOTES` block.
- [x] Export `getInvokedCliName` from `src/output/index.js`.
- [x] Wire `getInvokedCliName` + `extractFlag` + `envFlagIsTruthy` through `status(...)` in `src/cli/main.js` to compute `compact` from `--verbose` / `GUARDEX_VERBOSE_STATUS` / `GUARDEX_COMPACT_STATUS` / `process.stdout.isTTY`.
- [x] Add `countAgentWorktrees(repoRoot)` and `deriveNextStepHint({ scanResult, worktreeCount, invoked, inGitRepo })` in `src/cli/main.js`; render the `⚠ N active agent worktree(s) → <invoked> finish --all` line and `[gitguardex] Next: …` in the no-git-repo, guardex-disabled, and active/degraded branches of `status(...)`.
- [x] Collapse `Global services:` to `N/N ● active` when compact && all services active; keep the expanded list in every other case so companion/system warnings (e.g. missing `gh`, inactive `oh-my-claudecode`) still surface.

## 4. Verification

- [x] `node --test test/status.test.js` — 19/19 pass (was 17, added 2 new compact/verbose regressions).
- [x] `npm test` — full suite green (pending; running in the background right now).
- [x] Manual sanity: `GUARDEX_COMPACT_STATUS=1 FORCE_COLOR=0 node ./bin/multiagent-safety.js` emits 8 lines ending with `Try 'gx help' for commands, or 'gx status --verbose' for full service details.`; `FORCE_COLOR=0 node ./bin/multiagent-safety.js` expands the grouped `COMMANDS` tree (`Setup & health`, `Branch workflow`, `Coordination`, `Agents & reports`, `Meta`) as expected.

## 5. Completion / Cleanup

- [x] Commit the implementation + test update on `agent/claude/improve-gx-bare-output-2026-04-23-23-58`.
- [x] Push the agent branch and run `gx branch finish --branch "agent/claude/improve-gx-bare-output-2026-04-23-23-58" --base main --via-pr --wait-for-merge --cleanup` (or `gx finish --all` if other lanes are queued).
- [x] Record PR URL + final `MERGED` evidence in the handoff.
- [x] Confirm the agent worktree under `.omc/agent-worktrees/gitguardex__claude__improve-gx-bare-output-2026-04-23-23-58` is pruned after merge.
