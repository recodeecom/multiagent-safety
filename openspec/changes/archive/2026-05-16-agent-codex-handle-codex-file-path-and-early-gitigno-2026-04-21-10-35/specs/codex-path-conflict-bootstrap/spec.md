## ADDED Requirements

### Requirement: codex path conflict error clarity
Guardex setup and doctor SHALL explain when a reserved path such as `.codex` is a file instead of a directory.

#### Scenario: .codex file blocks bootstrap
- **WHEN** the target repo contains a regular file at `.codex`
- **THEN** `gx setup` and `gx doctor` fail with a readable Guardex error naming `.codex`
- **AND** the error explains that the path must be removed or renamed before retrying.

### Requirement: early managed gitignore bootstrap
Guardex SHALL write its managed `.gitignore` block before later bootstrap steps that can fail on path conflicts.

#### Scenario: partial bootstrap on path conflict
- **WHEN** setup or doctor aborts after `.gitignore` is written but before the full scaffold completes
- **THEN** the repo still has the managed `.gitignore` entries for generated scripts, lock state, and Guardex-managed local paths.
