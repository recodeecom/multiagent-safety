## Why

- `codex-agent` currently skips auto-finish whenever `origin` is a local-path remote, even when tests intentionally inject a working fake `gh` binary through `GUARDEX_GH_BIN`.
- Nested recursive-doctor tests create a fresh git repo under `frontend/` and call `seedCommit()` before any local identity exists, which now fails on CI runners without a global git identity.

## What Changes

- Allow the codex auto-finish path to use PR flow when the caller explicitly overrides the GitHub CLI binary via `GUARDEX_GH_BIN`, even if the repo remote is a local bare path.
- Ensure shared install-test helpers seed a local git identity before `seedCommit()` so nested repos can commit deterministically in CI.

## Impact

- Affects `scripts/codex-agent.sh`, `templates/scripts/codex-agent.sh`, and `test/install.test.js`.
- Keeps the existing skip behavior for local-path remotes when no explicit `GUARDEX_GH_BIN` override is provided.
