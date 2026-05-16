## ADDED Requirements

### Requirement: Protected-main doctor lifecycle lives under `src/doctor`
The CLI SHALL keep the protected-main `gx doctor` sandbox lifecycle in a dedicated `src/doctor` module instead of defining that lifecycle inline in `src/cli/main.js`.

#### Scenario: Main delegates protected-main doctor execution
- **GIVEN** a maintainer inspects the refactored CLI entrypoint
- **WHEN** they follow the protected-main `gx doctor` path
- **THEN** `src/cli/main.js` delegates the sandbox lifecycle into `src/doctor`
- **AND** the observable doctor output and exit behavior remain unchanged.

### Requirement: Shared git helpers are single-sourced under `src/git`
The CLI SHALL keep reusable branch/config helpers in `src/git` instead of redefining them in `src/cli/main.js`.

#### Scenario: Doctor and finish reuse the same git helpers
- **GIVEN** the doctor lifecycle and finish flows both need branch/config helpers
- **WHEN** the CLI resolves current branch, git config, ahead/behind counts, or merge status
- **THEN** those helpers come from `src/git`
- **AND** `src/cli/main.js` does not reintroduce local copies of those helpers.
