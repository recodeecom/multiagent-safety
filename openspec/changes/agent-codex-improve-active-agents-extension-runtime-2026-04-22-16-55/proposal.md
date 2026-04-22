## Why

- The Active Agents companion already has grouped rows, lock awareness, and AGENT.lock fallback, but the runtime contract is still thin in the high-value places: launcher heartbeat freshness, repo-root change filtering, per-session touched-file visibility, and context keys.
- The extension should stay a read-only state viewer. Any lifecycle action must continue shelling to `gx` rather than mutating git/session state directly.
- The duplicated install source trees (`vscode/guardex-active-agents/` and `templates/vscode/guardex-active-agents/`) have drifted, so the shipped extension can lag the template behavior.

## What Changes

- Extend the active-session writer schema with `lastHeartbeatAt` and advisory `state`, add a `heartbeat` subcommand, and wire `gx internal heartbeat --branch <branch>` to the helper.
- Keep the wrapper session record fresh while a Codex sandbox is running, and clear the heartbeat loop when the session exits.
- Filter repo-root `CHANGES` so managed agent worktree paths and active-session state files never appear as root dirt.
- Render changed-file rows beneath each session in `ACTIVE AGENTS`, including lock-conflict warnings when touched files are claimed by another branch.
- Set `guardex.hasAgents` and `guardex.hasConflicts` context keys from the provider summary.
- Reconcile the template/source extension copies and docs so local install uses the same behavior as tests.

## Impact

- Affected surfaces: `scripts/agent-session-state.js`, `scripts/codex-agent.sh`, `src/hooks/index.js`, `src/context.js`, both VS Code extension source trees, focused extension tests, and this OpenSpec change.
- Risk is bounded to local runtime state/view behavior. The extension remains read-only for state; finish/sync/stop/open actions still route through terminals or VS Code APIs.
- Large worktrees are sensitive to file scanning, so the patch preserves git/status-based bounded scans instead of introducing recursive unbounded watchers.
