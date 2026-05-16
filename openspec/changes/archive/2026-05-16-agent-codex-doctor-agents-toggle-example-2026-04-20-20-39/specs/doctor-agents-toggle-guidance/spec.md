## ADDED Requirements

### Requirement: AGENTS refresh teaches default-on Guardex toggle behavior
The managed AGENTS content refreshed by `gx setup` and `gx doctor` SHALL state that Guardex is enabled by default and SHALL show literal repo-root `.env` examples for disabling and re-enabling it.

#### Scenario: refreshed AGENTS block includes repo toggle examples
- **GIVEN** a repo AGENTS file with an outdated Guardex-managed block
- **WHEN** `gx setup` or `gx doctor` refreshes the managed block
- **THEN** the refreshed content SHALL state that Guardex is enabled by default
- **AND** it SHALL include `GUARDEX_ON=0` as the disable example
- **AND** it SHALL include `GUARDEX_ON=1` as the enable example
