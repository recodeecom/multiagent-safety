## Why

The bundled VS Code extension `Recodee.gitguardex-active-agents` and its supporting `agent-session-state.js` heartbeat plumbing were never adopted in practice. They added an install prompt to `gx setup`, kept the active-agent session writer running on every codex-agent launch, and shipped ~10k lines of extension source on every npm publish. None of it is required for the core gx guardrail flow.

## What Changes

- Remove the `vscode/guardex-active-agents/` extension source and its `templates/vscode/` mirror.
- Remove `scripts/agent-session-state.js` and its template (it only fed the deleted extension).
- Remove `scripts/install-vscode-active-agents-extension.js` and its template.
- Remove `maybePromptInstallVscodeExtension()` from `gx setup` (no install prompt, no `GUARDEX_SKIP_VSCODE_EXT_PROMPT` env).
- Remove `gx internal heartbeat` and `gx internal stop-session` subcommands (only the extension called them).
- Strip the `active_session_state_*` helper functions, heartbeat loop, and exit trap from `templates/scripts/codex-agent.sh`.
- Drop the `vscode/` template-path branch, `sessionState` package asset, and all `agent-session-state.js` entries from `TEMPLATE_FILES`, `PACKAGE_ROOT_SOURCE_OVERRIDES`, `LEGACY_MANAGED_REPO_FILES`, and `MANAGED_GITIGNORE_PATHS` in `src/context.js`.
- Update `test/setup.test.js`, `test/metadata.test.js`, and `test/helpers/install-test-helpers.js` to stop asserting on the removed files.

## Impact

- Smaller npm payload; no dead extension code on disk.
- `gx setup` and `gx doctor` no longer touch `code --install-extension`.
- `codex-agent.sh` no longer spawns a background heartbeat process per launch.
- Consumer repos that previously had `scripts/agent-session-state.js` scaffolded as gitignored will see it stop being re-materialized on the next `gx setup` — safe to delete locally.
- The `.vscode/settings.json` IDE settings (separate from the extension) are unchanged.
