# Tasks

## 1. Spec

- [x] 1.1 Capture empty-task launcher behavior.

## 2. Tests

- [x] 2.1 Cover task input reducer behavior for empty panels.
- [x] 2.2 Cover `gx agents start --panel --dry-run` rendering home without a task.
- [x] 2.3 Cover interactive empty-panel task entry before launch.
- [x] 2.4 Cover parser acceptance for empty `--panel` starts.

## 3. Implementation

- [x] 3.1 Allow empty task only for panel starts.
- [x] 3.2 Add task-input mode to the dmux-style panel controller.
- [x] 3.3 Route plain interactive `gx` to the launcher home.

## 4. Verification

- [x] 4.1 Run focused Node tests.
  - Evidence: `node --test test/agents-selection-panel.test.js test/agents-start-dry-run.test.js test/agents-start.test.js test/cli-args-dispatch.test.js test/agents-start-claims.test.js` passed (`33/33`).
- [x] 4.2 Validate OpenSpec change.
  - Evidence: `openspec validate agent-codex-gx-dmux-home-launcher-2026-04-30-11-31 --type change --strict` passed.
- [x] 4.3 Smoke `gx agents start --panel --dry-run`.
  - Evidence: `node bin/multiagent-safety.js agents --target /home/deadpool/Documents/recodee/gitguardex start --panel --dry-run` rendered the GitGuardex home panel with task input and no dry-run branch plans.

## 5. Cleanup

- [x] 5.1 Run the finish pipeline: `gx branch finish --branch agent/codex/gx-dmux-home-launcher-2026-04-30-11-31 --base main --via-pr --wait-for-merge --cleanup`.
  - Evidence: PR #493 merged as https://github.com/recodeee/gitguardex/pull/493 (`MERGED`, merge commit `efbb540d30981ceee2cf10ff5da6e2826e656b92`, merged at `2026-04-30T09:51:50Z`).
- [x] 5.2 Record PR URL, final `MERGED` state, and sandbox cleanup evidence.
  - Evidence: `gx cleanup --base main` removed `/home/deadpool/Documents/recodee/gitguardex/.omx/agent-worktrees/gitguardex__codex__gx-dmux-home-launcher-2026-04-30-11-31`; `git worktree list` shows only `/home/deadpool/Documents/recodee/gitguardex`; local and remote `agent/codex/gx-dmux-home-launcher-2026-04-30-11-31` refs are absent.
