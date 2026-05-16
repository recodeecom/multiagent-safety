## ADDED Requirements

### Requirement: release version bumps stay publishable and documented
The release workflow SHALL advance package metadata to a publishable version and record the matching release notes in the same change.

#### Scenario: patch release prep for npm publish
- **GIVEN** the published npm version for `@imdeadpool/guardex` is `7.0.6`
- **WHEN** the repo prepares the next publishable release
- **THEN** `package.json` SHALL declare version `7.0.7`
- **AND** the root package entry in `package-lock.json` SHALL also declare version `7.0.7`
- **AND** `README.md` SHALL contain a `### v7.0.7` release-notes entry describing the release
