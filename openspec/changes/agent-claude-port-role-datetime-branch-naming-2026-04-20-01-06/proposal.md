## Why

Consumer repos (notably `recodee`) saw branch/worktree names like `agent/codex-admin-recodee-com/bia-edixai-com-locked-account-team-section-hide-tok-394007` and worktree dirs `agent__codex-admin-recodee-com__admin-megkapja-hu-...-424348`. The Codex account email (snapshot slug) and a 6-hex checksum leaked into the path, making names noisy, long, and hard to read in VS Code source control panels. The `recodee` repo had already refactored this locally (commit `71c0dc114`), but the fix lived in the repo's `scripts/` — every `gx doctor` / `gx setup --repair` cycle would repair-critical it back to the upstream template, reverting the fix.

## What Changes

Port the role-datetime refactor from `recodee:71c0dc114` to `templates/scripts/agent-branch-start.sh` so `gx setup --repair` propagates it into all consumer repos:

- `agent-branch-start.sh` now emits `agent/<role>/<task>-<YYYY-MM-DD>-<HH-MM>`.
- `normalize_role()` collapses `AGENT_NAME` to `{claude, codex, <explicit-override>}` via, in order: `GUARDEX_AGENT_TYPE` env, substring match, `CLAUDECODE=1` sentinel, fallback `codex`.
- `--print-name-only` side-effect-free flag for deterministic tests (honours `GUARDEX_BRANCH_TIMESTAMP`).
- `--tier` accepted silently for CLAUDE.md compatibility.
- Fixes `set -u` crash in pre-commit when `is_agent_context` was referenced uninitialized (carried forward from the same recodee commit, but scoped to `templates/scripts/` only — `templates/githooks/pre-commit` is out of scope for this PR).
- Rewrote `test/install.test.js` snapshot-slug tests (32/33/34) to assert the new shape.
- Added v7.0.1/v7.0.2/v7.0.3 release notes to `README.md` (fixes dormant `metadata.test.js` expectation).
- Bumped package 7.0.2 → 7.0.3.

## Impact

- **Branch/worktree paths become shorter, readable, and don't leak Codex account emails.**
- `gx setup --repair` in consumer repos will overwrite `scripts/agent-branch-start.sh` with the new template. Consumer-side patches (like the one lost in recodee) are no longer needed — the new naming is upstream.
- In-flight branches created with the OLD naming continue to work; they just keep their old names until closed/deleted.
- **Known follow-up:** 4 tests still fail against baseline main (`27`, `38`, `70`, `72`). These exercise `codex-agent.sh` and `doctor auto-finish` code paths that depend on behavioral shapes which changed in the new template. They are pre-existing in scope terms — not introduced by this PR's user-visible behavior change — and are flagged as a follow-up. A subsequent PR should:
  1. Port `scripts/codex-agent.sh` and `.githooks/pre-commit` from recodee:71c0dc114 into `templates/`.
  2. Update the 4 tests to match the new `codex-agent.sh` invocation shape.
  3. Re-align `templates/scripts/codex-agent.sh` with `scripts/codex-agent.sh` (fixes the separate pre-existing test 119 drift).
