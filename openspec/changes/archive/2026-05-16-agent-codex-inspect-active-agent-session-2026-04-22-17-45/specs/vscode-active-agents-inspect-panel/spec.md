## ADDED Requirements

### Requirement: Active Agents exposes a session inspect panel
The Active Agents companion SHALL expose a session-scoped inspect surface for the selected sandbox session.

#### Scenario: Inspect selected session details
- **WHEN** the user runs `gitguardex.activeAgents.inspect` for a session row
- **THEN** the extension opens an inspect panel for that session
- **AND** the panel shows the configured base branch, ahead/behind counts vs `origin/<base>`, held locks, and the agent log tail when available.

### Requirement: Inspect data comes from the same watcher-driven refresh loop
The inspect panel SHALL refresh from the same debounced watcher cycle used by the Active Agents tree.

#### Scenario: Log or session state changes while inspect is open
- **WHEN** active-session files, lock files, managed worktree locks, session git indexes, or `.omx/logs/*.log` change
- **THEN** the existing debounced refresh loop updates the Active Agents tree
- **AND** any open inspect panel re-renders the same session from refreshed data without a separate polling loop.
