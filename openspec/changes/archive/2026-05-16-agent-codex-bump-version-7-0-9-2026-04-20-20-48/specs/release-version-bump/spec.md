## ADDED Requirements

### Requirement: publishable release bumps stay documented
The release workflow SHALL advance package metadata to a fresh publishable version and record the matching release notes in the same change.

#### Scenario: patch release prep after AGENTS toggle examples land
- **GIVEN** the repo currently declares version `7.0.8`
- **AND** the current branch state includes `gx doctor` / `gx setup` refreshing AGENTS with `GUARDEX_ON=0` and `GUARDEX_ON=1` examples
- **WHEN** the repo prepares the next publishable release
- **THEN** `package.json` SHALL declare version `7.0.9`
- **AND** the root package entry in `package-lock.json` SHALL also declare version `7.0.9`
- **AND** `README.md` SHALL contain a `### v7.0.9` release-notes entry describing the AGENTS toggle examples
