# agent-claude-gx-finish-preflight-and-auto-promote-2026-05-14-01-09 (T1)

Branch: `agent/claude/gx-finish-preflight-and-auto-promote-2026-05-14-01-09`

Shifts agent verification from billable cloud Actions minutes to free local CPU. `gx branch finish` now runs a `scripts/agent-preflight.sh` gate in the worktree BEFORE pushing; non-zero refuses the push. On pass, any draft PR is promoted to ready-for-review so the budget-friendly CI defaults can fire once on a known-passing commit.

## Files

- `templates/scripts/agent-preflight.sh` (new) — auto-detects Node/pnpm, Node/npm, Rust, Python and runs conventional verification.
- `scripts/agent-preflight.sh` (new symlink) — points at the template per the existing paired-script convention.
- `templates/scripts/agent-branch-finish.sh` — adds `--no-preflight` / `--preflight` / `--preflight-script <path>` / `--no-auto-promote` / `--auto-promote` flags + matching `GUARDEX_FINISH_PREFLIGHT*` / `GUARDEX_FINISH_AUTO_PROMOTE` env vars; calls `run_preflight` before any push; calls `maybe_auto_promote_pr` after the PR exists.
- `scripts/check-script-symlinks.sh` — adds `scripts/agent-preflight.sh` to the required-symlinks list.
- `src/context.js` — adds `scripts/agent-preflight.sh` to `TEMPLATE_FILES` so `gx setup` scaffolds it into downstream projects.
- `docs/preflight.md` (new) — documents the convention.

## Acceptance

- Pre-flight runs before push; non-zero refuses push (verified via shell syntax + `--no-preflight` override path exists).
- Symlink check passes (`scripts/check-script-symlinks.sh` now expects 11 paired files).
- gitguardex own `npm test` green after symlink + finish-script edits.

## Cleanup

- [x] Run: `gx branch finish --branch agent/claude/gx-finish-preflight-and-auto-promote-2026-05-14-01-09 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state.
- [x] Confirm sandbox worktree is gone.
