## ADDED Requirements

### Requirement: setup current alias limits bootstrap to the target repo
The system SHALL support `gx setup --current` as an alias for the existing top-level-only traversal path.

#### Scenario: current alias skips nested repo installs
- **GIVEN** a parent repo contains a nested standalone git repo
- **WHEN** `gx setup --target <parent-repo> --current` runs
- **THEN** the setup flow SHALL install or repair only `<parent-repo>`
- **AND** the nested repo SHALL not be traversed or modified during that run.
