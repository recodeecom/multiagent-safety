## Why

- The GitGuardEx VS Code companion currently depends on `.omx/state/active-sessions/*.json`.
- That misses real live sandboxes when operators start a worktree with `gx branch start` and the live source is only the worktree-root `AGENT.lock` marker.
- Result: the Source Control view can look empty or stale even while a managed worktree is actively owned and changing.

## What Changes

- Teach the Active Agents companion to discover live managed worktrees from root-level `AGENT.lock` markers in `.omx/agent-worktrees/**` and `.omc/agent-worktrees/**`.
- Merge those synthetic live rows with the existing `.omx/state/active-sessions/*.json` records, preferring the richer session file when both exist for the same worktree.
- Keep the current SCM affordances, lock decorations, and change nesting behavior, but make refresh/watch logic observe worktree-root `AGENT.lock` files too.
- Document the fallback behavior in the extension README.

## Risks

- `AGENT.lock` is optional telemetry, so parsing must degrade safely and ignore invalid or stale files instead of crashing the view.
- Synthetic rows have no launcher PID, so stop/dead semantics must remain tied to wrapper session records only.
