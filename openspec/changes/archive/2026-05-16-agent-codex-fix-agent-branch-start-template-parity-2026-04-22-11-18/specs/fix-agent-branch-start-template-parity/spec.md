## ADDED Requirements

### Requirement: branch-start runtime preserves template bootstrap parity
The runtime `scripts/agent-branch-start.sh` SHALL preserve the same bootstrap behavior and user guidance as `templates/scripts/agent-branch-start.sh`.

#### Scenario: OpenSpec bootstrap uses the CLI-owned path
- **WHEN** `scripts/agent-branch-start.sh` initializes OpenSpec workspaces in a new agent worktree
- **THEN** it invokes change and plan initialization through `gx internal run-shell ...`
- **AND** it does not rehydrate deprecated local helper copies into the worktree.

#### Scenario: printed next steps match the supported CLI surface
- **WHEN** `scripts/agent-branch-start.sh` prints the post-start handoff instructions
- **THEN** it points users at `gx locks claim`
- **AND** it points users at `gx branch finish`.
