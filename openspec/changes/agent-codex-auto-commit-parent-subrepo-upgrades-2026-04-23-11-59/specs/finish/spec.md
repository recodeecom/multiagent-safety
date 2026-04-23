## ADDED Requirements

### Requirement: Parent Gitlink Auto-Commit

After a successful nested repository finish, Guardex SHALL detect when the finished repository's base worktree is tracked as a `160000` gitlink in a containing superproject and SHALL attempt to commit only that gitlink path in the parent repository.

#### Scenario: Nested repo finish advances parent gitlink

- **GIVEN** a nested repo is tracked as a gitlink by a parent repo
- **WHEN** `gx branch finish` merges the nested agent branch and fast-forwards the nested base worktree
- **THEN** Guardex commits the parent repo gitlink path with a message naming that subrepo pointer
- **AND** unrelated parent staged paths are not included in that commit

#### Scenario: Parent auto-commit is disabled

- **GIVEN** parent gitlink auto-commit is disabled by flag or environment
- **WHEN** a nested repo finish advances the nested base worktree
- **THEN** Guardex skips the parent gitlink commit attempt
