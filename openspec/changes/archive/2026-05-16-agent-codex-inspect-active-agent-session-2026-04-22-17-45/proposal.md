## Why

- Active Agents already lets the user open a worktree, diff changes, and finish or stop a session, but there is still no single scan-first surface inside VS Code for "why is this branch stuck?"
- The missing inspect surface forces the user back to the terminal to piece together branch divergence, held locks, and agent logs for the selected session.

## What Changes

- Add `gitguardex.activeAgents.inspect` to the Active Agents companion manifest and expose it as a session-scoped inline action.
- Add inspect-data helpers in `session-schema.js` for configured base-branch lookup, ahead/behind counts, session log path + tail, and held-lock extraction.
- Add a single webview inspect panel in `extension.js` that renders the selected session and refreshes through the same debounced watcher path used by the tree view, including `.omx/logs/*.log`.
- Mirror the runtime changes into `templates/vscode/guardex-active-agents/*` and cover the inspect flow in `test/vscode-active-agents-session-state.test.js`.

## Impact

- Affected surfaces: `vscode/guardex-active-agents/*`, `templates/vscode/guardex-active-agents/*`, and `test/vscode-active-agents-session-state.test.js`.
- Risks: the inspect panel touches both manifest and refresh/watcher plumbing, so the live and template copies must stay in sync and the focused extension test must remain green.
- Rollout note: the extension manifest version must increase because shipped extension files change.
