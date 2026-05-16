# doctor-agents-toggle-guidance Specification

## Purpose
TBD - created by archiving change agent-codex-doctor-agents-toggle-example-2026-04-20-20-39. Update Purpose after archive.
## Requirements
### Requirement: AGENTS refresh teaches default-on Guardex toggle behavior
The managed AGENTS content refreshed by `gx setup` and `gx doctor` SHALL state that Guardex is enabled by default and SHALL show literal repo-root `.env` examples for disabling and re-enabling it.

#### Scenario: refreshed AGENTS block includes repo toggle examples
- **GIVEN** a repo AGENTS file with an outdated Guardex-managed block
- **WHEN** `gx setup` or `gx doctor` refreshes the managed block
- **THEN** the refreshed content SHALL state that Guardex is enabled by default
- **AND** it SHALL include `GUARDEX_ON=0` as the disable example
- **AND** it SHALL include `GUARDEX_ON=1` as the enable example

