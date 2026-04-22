## ADDED Requirements

### Requirement: Active Agents view falls back to live managed worktree telemetry
The GitGuardEx Active Agents VS Code companion SHALL surface managed worktrees that expose a live root-level `AGENT.lock` marker, even when no `.omx/state/active-sessions/*.json` launcher record exists for that worktree.

#### Scenario: Managed worktree lock creates a synthetic live row
- **WHEN** a managed Guardex worktree under `.omx/agent-worktrees/` or `.omc/agent-worktrees/` contains a valid `AGENT.lock`
- **AND** no `.omx/state/active-sessions/*.json` record exists for that same worktree
- **THEN** the Active Agents SCM view shows a live row for that worktree
- **AND** the row still derives `thinking` versus `working` from the worktree git state.

#### Scenario: Wrapper session record wins over lock fallback
- **WHEN** both a valid `.omx/state/active-sessions/*.json` record and a valid root `AGENT.lock` exist for the same managed worktree
- **THEN** the companion renders a single row for that worktree
- **AND** it prefers the launcher-backed session metadata instead of duplicating the row.

#### Scenario: Lock fallback refreshes with worktree telemetry updates
- **WHEN** a managed worktree `AGENT.lock` file is created, changed, or deleted
- **THEN** the Active Agents companion refreshes the affected SCM rows
- **AND** invalid lock payloads are ignored without crashing the view.
