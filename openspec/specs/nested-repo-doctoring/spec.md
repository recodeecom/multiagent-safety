# nested-repo-doctoring Specification

## Purpose
TBD - created by archiving change doctor-current-single-repo-alias. Update Purpose after archive.
## Requirements
### Requirement: doctor current alias limits repairs to the target repo
The system SHALL support `gx doctor --current` as a doctor-only alias for the existing single-repo repair path.

#### Scenario: current alias skips nested repo repairs
- **GIVEN** a parent repo contains a nested standalone git repo with Guardex-managed drift
- **WHEN** `gx doctor --target <parent-repo> --current` runs
- **THEN** the doctor flow SHALL repair only `<parent-repo>`
- **AND** the nested repo SHALL not be traversed or repaired during that run.

### Requirement: recursive doctor repairs nested repos
The system SHALL repair nested standalone git repos during `gx doctor` so local Guardex enforcement is restored across the whole target tree, not only the top-level repo.

#### Scenario: parent doctor repairs a nested frontend repo on protected main
- **GIVEN** a parent repo contains a nested standalone frontend repo on protected `main`
- **AND** the nested repo is missing Guardex-managed files such as `AGENTS.md`, `scripts/agent-branch-start.sh`, or `.githooks/pre-commit`
- **WHEN** `gx doctor --target <parent-repo>` runs
- **THEN** the doctor flow SHALL recurse into the nested repo
- **AND** protected-branch sandbox repair SHALL sync the repaired managed Guardex files back to the nested repo primary workspace
- **AND** `gx scan --target <nested-repo>` SHALL report no safety issues after the repair completes.

