## ADDED Requirements

### Requirement: Dirty matching managed worktree reuse
`gx branch start` SHALL, when reuse is enabled, inspect managed `.omx/agent-worktrees` and `.omc/agent-worktrees` before creating a fresh branch from the protected checkout.

#### Scenario: A single dirty same-agent worktree matches the requested task
- **GIVEN** the current checkout is on a protected branch
- **AND** exactly one managed worktree is on an `agent/<same-agent>/...` branch
- **AND** that worktree has local changes
- **AND** the requested task shares at least one meaningful token with that branch descriptor
- **WHEN** `gx branch start --reuse-existing "<task>" "<same-agent>"` runs
- **THEN** the command reuses the existing dirty worktree
- **AND** it does not create a new `agent/*` branch.

#### Scenario: No unique dirty same-agent match exists
- **GIVEN** reuse is enabled
- **WHEN** there is no dirty same-agent managed worktree with a meaningful task-token match
- **THEN** `gx branch start` creates a fresh branch using the existing branch-start flow.

#### Scenario: More than one matching dirty same-agent worktree exists
- **GIVEN** reuse is enabled
- **WHEN** more than one dirty same-agent managed worktree has the same best token-match score
- **THEN** `gx branch start` does not auto-select one of them
- **AND** it creates a fresh branch using the existing branch-start flow.
