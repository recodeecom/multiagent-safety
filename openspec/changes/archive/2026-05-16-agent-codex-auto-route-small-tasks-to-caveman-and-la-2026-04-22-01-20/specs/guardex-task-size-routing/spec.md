## ADDED Requirements

### Requirement: Guardex-managed AGENTS task-size routing
The managed AGENTS block produced by `gx setup` and `gx doctor` SHALL tell downstream repos to keep small, bounded tasks in direct caveman-only mode and reserve heavy OMX orchestration for larger scope.

#### Scenario: setup refresh writes small-task lightweight routing
- **WHEN** `gx setup` refreshes or installs the managed AGENTS block
- **THEN** the block says small tasks stay in direct caveman-only mode
- **AND** it treats bounded asks such as typos, single-file tweaks, one-liners, and version bumps as lightweight by default.

#### Scenario: setup refresh writes heavy-mode promotion rules
- **WHEN** the managed AGENTS block is refreshed
- **THEN** it says OMX orchestration is promoted only for medium/large work
- **AND** it names heavy OMX modes as the larger-scope path instead of the default path.

### Requirement: lightweight escape hatches stay explicit
The managed AGENTS block SHALL document explicit lightweight prefixes that force small-task handling.

#### Scenario: lightweight prefixes remain available
- **WHEN** the agent reads the managed AGENTS block
- **THEN** it sees `quick:`, `simple:`, `tiny:`, `minor:`, `small:`, `just:`, and `only:` as explicit lightweight escape hatches
- **AND** those prefixes bias the task toward direct caveman-only handling.
