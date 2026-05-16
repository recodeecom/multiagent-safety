# Tasks

## 1. Spec

- [x] Capture the inline companion-install prompt contract in `specs/cli-output/spec.md` (requirements + TTY gating + opt-out env vars).

## 2. Tests

- [x] Keep `test/status.test.js` existing bare-gx TTY-gated tests green (they pass because tests don't provide a TTY stdin).
- [x] Refresh the `GUARDEX_AUTO_DOCTOR=yes` assertion to match the `--current` upgrade from the previous change.

## 3. Implementation

- [x] `src/toolchain/index.js`: extract the install loop into `performCompanionInstall(missingPackages, missingLocalTools)` and export it alongside `buildMissingCompanionInstallPrompt`.
- [x] `src/cli/main.js`: extract service detection into `collectServicesSnapshot()` so `status(...)` can re-detect after an install.
- [x] `src/cli/main.js`: add `maybePromptInstallMissingCompanions(snapshot)` that respects `GUARDEX_SKIP_COMPANION_PROMPT`, honors `GUARDEX_AUTO_COMPANION_APPROVAL`, requires TTY stdout+stdin by default, prints the missing list, calls `promptYesNoStrict(buildMissingCompanionInstallPrompt(...))`, runs `performCompanionInstall(...)`, and reports installed/failed/skipped.
- [x] Wire the helper into `status(rawArgs)` before rendering. Re-run `collectServicesSnapshot()` when the install succeeds so the banner reflects the post-install state.

## 4. Verification

- [x] `node --test test/status.test.js` — 19/19 green.
- [x] Manual: `FORCE_COLOR=0 GUARDEX_SKIP_COMPANION_PROMPT=1 node ./bin/multiagent-safety.js` renders the banner without firing the prompt (opt-out works).
- [x] Manual: the interactive path is TTY-gated (tests use non-TTY stdin, so no prompt; existing assertions still pass).

## 5. Completion / Cleanup

- [x] Commit on `agent/claude/bare-gx-prompt-missing-companions-2026-04-24-00-32`.
- [x] `gx branch finish --branch "agent/claude/bare-gx-prompt-missing-companions-2026-04-24-00-32" --base main --via-pr --wait-for-merge --cleanup`.
- [x] Capture PR URL + final `MERGED` evidence in the handoff.
- [x] Confirm the agent worktree under `.omc/agent-worktrees/gitguardex__claude__bare-gx-prompt-missing-companions-2026-04-24-00-32` is pruned after merge.
