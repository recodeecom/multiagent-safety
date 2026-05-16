# pr-merge-current-main-changes Specification

## Purpose
TBD - created by archiving change agent-codex-pr-merge-current-main-changes-2026-04-20-00-29. Update Purpose after archive.
## Requirements
### Requirement: Worktree-isolated merge-to-main workflow for current frontend export snapshot
The system SHALL allow committing and merging the current frontend export snapshot through an isolated agent worktree branch, not directly on `main`.

#### Scenario: Baseline acceptance
- **WHEN** the pending frontend export snapshot changes are finalized
- **THEN** they are committed on an `agent/*` worktree branch
- **AND** merged to `main` through a PR completion flow.

