## ADDED Requirements

### Requirement: `gx doctor` uses semantic status colors
When ANSI color output is enabled, the human-readable `gx doctor` workflow SHALL color success lines green, failure lines red, and skip or pending lines yellow.

#### Scenario: safe doctor lines render green
- **GIVEN** `gx doctor` runs in human-readable mode with ANSI color output enabled
- **WHEN** the repo scan reports `No safety issues detected.` and doctor reaches `Repo is fully safe.`
- **THEN** both success lines SHALL be emitted in green

#### Scenario: doctor auto-finish failures render red
- **GIVEN** `gx doctor` runs in human-readable mode with ANSI color output enabled
- **AND** the auto-finish sweep reports at least one failed branch result
- **WHEN** doctor prints the auto-finish summary and failed branch detail
- **THEN** the failure summary line SHALL be emitted in red
- **AND** the failed branch detail line SHALL be emitted in red

#### Scenario: doctor skip or pending lines render yellow
- **GIVEN** `gx doctor` runs in human-readable mode with ANSI color output enabled
- **WHEN** doctor prints a skipped or pending auto-finish line
- **THEN** that line SHALL be emitted in yellow
