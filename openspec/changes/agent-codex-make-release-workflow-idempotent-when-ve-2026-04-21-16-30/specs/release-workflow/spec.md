## ADDED Requirements

### Requirement: Release workflow skips already-published package versions
The `Release to npm (provenance)` workflow SHALL verify the package on every run, but it SHALL skip `npm publish` when the exact `package.json` version is already present on npm.

#### Scenario: workflow_dispatch on an already-published version
- **GIVEN** the workflow is running against a commit whose `package.json` version already exists on npm
- **WHEN** the verify steps complete successfully
- **THEN** the workflow SHALL detect that published version before the publish step
- **AND** it SHALL report that publish is being skipped instead of failing on `npm publish`.
