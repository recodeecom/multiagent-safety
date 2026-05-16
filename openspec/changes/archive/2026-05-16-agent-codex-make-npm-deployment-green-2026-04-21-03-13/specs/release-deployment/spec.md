## ADDED Requirements

### Requirement: canonical npm release trigger
The release workflow SHALL publish npm releases from explicit release publication or manual dispatch only.

#### Scenario: published release deployment
- **WHEN** maintainers publish a GitHub release for a new package version
- **THEN** the npm release workflow runs for that published release
- **AND** the workflow does not also trigger a second publish job from the tag push for the same version.

### Requirement: fresh publish target
Each release-bound package version SHALL target an unpublished npm version and matching release notes.

#### Scenario: next patch release after a failed deployment
- **WHEN** the previous deployment is red but that version already exists on npm
- **THEN** the package manifest advances to a new patch version
- **AND** README release notes include a heading for that new version in the same change.
