## Why

- `gx doctor` currently surfaces managed-file conflicts like `scripts/review-bot-watch.sh`, but the recovery hint is incomplete: users can reasonably try `gx doctor --force scripts/review-bot-watch.sh` and hit `Unknown option`.
- `gx setup` has the same gap for managed template conflicts like `.github/workflows/cr.yml`.
- The CLI already distinguishes managed files from repo-owned package scripts and AGENTS content, so the remaining missing piece is a safe, explicit way to force only the named managed path instead of all managed files.

## What Changes

- Allow `gx setup`, `gx doctor`, and the shared repair/install aliases to accept managed relative paths after `--force`.
- Keep plain `--force` as the whole-surface rewrite path.
- Update managed-file conflict errors to explain both recovery options:
  - `--force <managed-path>` to rewrite only that file
  - `--force` to rewrite all managed files
- Add install regressions for targeted doctor/setup force-path recovery.

## Scope

- `bin/multiagent-safety.js`
- `test/install.test.js`

## Risks

- Path matching must stay relative and deterministic so targeted force rewrites only the named managed file.
- The parser change must not accidentally relax other commands into accepting stray positional arguments.
