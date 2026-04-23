# Patch Active Agents empty-list fallback

## Problem

The VS Code Active Agents view can show `No active Guardex agents` even when `gx branch start` has created a managed sandbox under `.omx/agent-worktrees/`. The current fallback only sees launcher session JSON files or `AGENT.lock` telemetry, so plain Guardex worktrees stay invisible.

## Scope

- Teach the session reader to synthesize rows from real managed `agent/*` git worktrees when no launcher state or `AGENT.lock` exists.
- Keep richer `AGENT.lock` telemetry preferred when present.
- Add focused regression coverage for session discovery and the SCM tree view.

## Out Of Scope

- New VS Code commands or layout redesigns.
- Changes to branch creation, launcher heartbeat emission, or lock ownership semantics.
