## ADDED Requirements

### Requirement: codex-agent auto-finish respects explicit GitHub CLI overrides
`codex-agent` SHALL allow the PR-based auto-finish path to run when the caller explicitly sets `GUARDEX_GH_BIN`, even if the repo's `origin` URL is a local-path remote used by tests.

#### Scenario: Local-path origin with explicit GitHub CLI override
- **GIVEN** a repo whose `origin` remote is a local bare path
- **AND** `GUARDEX_GH_BIN` points to an executable CLI shim
- **WHEN** `codex-agent` runs with auto-finish enabled
- **THEN** it SHALL invoke the PR-based finish flow instead of skipping auto-finish because of the local-path remote.

### Requirement: shared install-test helpers seed local git identity
Shared install-test helpers SHALL configure a local git author identity before creating seed commits in ad hoc nested repos.

#### Scenario: Nested frontend repo seed commit
- **GIVEN** a nested git repo created directly inside an install test
- **WHEN** `seedCommit()` prepares the initial commit
- **THEN** the helper SHALL configure local `user.name` and `user.email` first
- **AND** the seed commit SHALL not depend on any global git identity on the runner.
