## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-allow-human-commits-on-main-2026-04-20-08-21`.
- [x] 1.2 Define normative requirements in `specs/allow-human-commits-on-main/spec.md`.

## 2. Implementation

- [x] 2.1 Add `is_agent_session` superset (OR of `CODEX_THREAD_ID`/`OMX_SESSION_ID`/`CODEX_CI`/`CLAUDECODE`/`CLAUDE_CODE_SESSION_ID`) to `.githooks/pre-commit`, `.githooks/pre-push`, `templates/githooks/pre-commit`, `templates/githooks/pre-push`.
- [x] 2.2 Gate the protected-branch block in all four hooks so it only triggers when `is_agent_session == 1`; humans short-circuit with `exit 0`.
- [x] 2.3 Replace the dead `$is_agent_context` reference in `templates/githooks/pre-commit` with `is_agent_session` (would crash under `set -u`).
- [x] 2.4 Sanitize `CLAUDECODE` / `CLAUDE_CODE_SESSION_ID` in `test/install.test.js::runCmd` so host-shell env leakage cannot turn simulated "human" cases into agent sessions.
- [x] 2.5 Flip existing protected-branch "blocks non-codex human" assertions in `test/install.test.js` to "allows human" assertions; add new coverage that `CLAUDECODE=1` is blocked by both pre-commit and pre-push hooks.

## 3. Verification

- [x] 3.1 `bash -n .githooks/pre-commit .githooks/pre-push templates/githooks/pre-commit templates/githooks/pre-push` — all four scripts parse cleanly.
- [x] 3.2 Manual smoke from worktree: `env -u CLAUDECODE git -c core.hooksPath=.githooks commit --allow-empty …` exits 0; `CLAUDECODE=1 git -c core.hooksPath=.githooks commit --allow-empty …` exits 1 with `[agent-branch-guard] Direct commits on protected branches are blocked.`.
- [x] 3.3 `npm test` — targeted pre-commit/pre-push cases listed in §2.5 pass (16/16: `node --test --test-name-pattern="pre-commit|pre-push|Claude Code" test/install.test.js`). Overall delta vs baseline: 14 install.test.js failures all map to pre-existing PR #156 regressions (setup/doctor/codex-agent script shape + agent-branch-start legacy paths); no new failures introduced by this change.
- [x] 3.4 `openspec validate agent-claude-allow-human-commits-on-main-2026-04-20-08-21 --type change --strict` → "Change … is valid".
- [x] 3.5 `openspec validate --specs` → "No items found to validate" (repo carries no main-spec entries; strict-change validation is the authoritative gate here).

## 4. Cleanup

- [x] 4.1 Run `scripts/agent-branch-finish.sh --branch agent/claude/allow-human-commits-on-main-2026-04-20-08-21 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL + final state (`MERGED`) and confirm sandbox worktree removed (`git worktree list` / `git branch -a`).
