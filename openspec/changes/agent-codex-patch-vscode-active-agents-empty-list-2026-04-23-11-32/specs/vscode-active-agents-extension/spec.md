## ADDED Requirements

### Requirement: Active Agents shows managed sandboxes without launcher telemetry

The GitGuardex Active Agents VS Code companion SHALL surface real managed `agent/*` git worktrees under `.omx/agent-worktrees/` and `.omc/agent-worktrees/` even when no `.omx/state/active-sessions/*.json` launcher record and no worktree `AGENT.lock` telemetry exists.

#### Scenario: Plain managed worktree is visible

- **GIVEN** a repository has a managed worktree under `.omx/agent-worktrees/`
- **AND** that worktree is checked out on an `agent/*` branch
- **AND** there is no active-session JSON file or worktree `AGENT.lock`
- **WHEN** the Active Agents view refreshes
- **THEN** the view shows that worktree as an active agent row
- **AND** dirty files inside the worktree drive the row activity state and changed-file count

#### Scenario: Telemetry remains preferred

- **GIVEN** a managed worktree has valid `AGENT.lock` telemetry
- **WHEN** the Active Agents view refreshes
- **THEN** the view uses the richer telemetry-backed session data for that worktree instead of the plain fallback row
