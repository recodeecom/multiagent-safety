## ADDED Requirements

### Requirement: Dry-run agent start planning
`gx agents start <task> --dry-run` SHALL print the planned agent start details without mutating repository or session state.

#### Scenario: Previewing a Codex agent launch
- **WHEN** a user runs `gx agents start "fix auth tests" --agent codex --base main --dry-run`
- **THEN** Guardex prints the inferred task slug, planned `agent/codex/...` branch, planned `.omx/agent-worktrees/...` worktree path, and planned Codex launch command
- **AND** it does not create the branch, create the worktree, write session metadata, or launch an agent process.

#### Scenario: Rejecting an unknown agent id
- **WHEN** a user runs `gx agents start "update docs" --agent bogus --dry-run`
- **THEN** Guardex rejects the command before planning or mutation.
