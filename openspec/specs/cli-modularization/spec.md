# cli-modularization Specification

## Purpose
TBD - created by archiving change agent-codex-decompose-cli-monolith-2026-04-22-11-06. Update Purpose after archive.
## Requirements
### Requirement: Thin CLI entrypoint
The CLI SHALL keep `bin/multiagent-safety.js` as a thin bootstrap surface that delegates command execution into `src/cli`.

#### Scenario: Entrypoint delegates into src/cli
- **WHEN** the published CLI binary is executed
- **THEN** `bin/multiagent-safety.js` loads the modular runtime from `src/cli/main.js`
- **AND** command dispatch logic no longer depends on the monolithic file body.

### Requirement: Module seams mirror operational responsibility
The CLI SHALL separate major operational seams into dedicated modules under `src/` instead of keeping duplicated helper ownership in `src/cli/main.js`.

#### Scenario: Extracted helper ownership stays single-source
- **WHEN** maintainers inspect `src/cli/main.js`
- **THEN** parser helpers are imported from `src/cli/args.js`
- **AND** git/worktree helpers are imported from `src/git/index.js`
- **AND** command typo/deprecation helpers are imported from `src/cli/dispatch.js`
- **AND** `src/cli/main.js` does not redefine those helpers locally.

### Requirement: Refactor preserves targeted CLI behavior
The modularization SHALL preserve the current command surface for targeted verified flows while deleting the local duplicate helpers.

#### Scenario: Extracted helper seams remain wired through representative commands
- **WHEN** the focused CLI regression suites are run after the helper cleanup
- **THEN** representative command routes still execute through `src/cli/main.js`
- **AND** syntax/require-time failures do not occur from duplicate helper definitions.

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

