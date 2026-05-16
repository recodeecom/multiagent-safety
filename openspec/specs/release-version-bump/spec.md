# release-version-bump Specification

## Purpose
TBD - created by archiving change agent-codex-release-guardex-7-0-15-2026-04-21-12-16. Update Purpose after archive.
## Requirements
### Requirement: Release recovery version alignment
The release metadata SHALL move to the next publishable package version when npm rejects the current version as already published.

#### Scenario: Recover from an already-published npm version
- **GIVEN** `npm publish` rejects the current Guardex version as already published
- **WHEN** maintainers prepare the recovery release
- **THEN** `package.json` and `package-lock.json` SHALL be bumped to the next publishable semver
- **AND** `README.md` SHALL record the new release version with the newly shipped behavior that the package now contains.

### Requirement: release version bumps stay publishable and documented
The release workflow SHALL advance package metadata to a publishable version and record the matching release notes in the same change.

#### Scenario: patch release prep for npm publish
- **GIVEN** the published npm version for `@imdeadpool/guardex` is `7.0.6`
- **WHEN** the repo prepares the next publishable release
- **THEN** `package.json` SHALL declare version `7.0.7`
- **AND** the root package entry in `package-lock.json` SHALL also declare version `7.0.7`
- **AND** `README.md` SHALL contain a `### v7.0.7` release-notes entry describing the release

### Requirement: publishable release bumps stay documented
The release workflow SHALL advance package metadata to a fresh publishable version and record the matching release notes in the same change.

#### Scenario: patch release prep after AGENTS toggle examples land
- **GIVEN** the repo currently declares version `7.0.8`
- **AND** the current branch state includes `gx doctor` / `gx setup` refreshing AGENTS with `GUARDEX_ON=0` and `GUARDEX_ON=1` examples
- **WHEN** the repo prepares the next publishable release
- **THEN** `package.json` SHALL declare version `7.0.9`
- **AND** the root package entry in `package-lock.json` SHALL also declare version `7.0.9`
- **AND** `README.md` SHALL contain a `### v7.0.9` release-notes entry describing the AGENTS toggle examples

### Requirement: Release metadata and bundled companion version alignment

The release metadata SHALL move to the next publishable Guardex package version when maintainers intentionally request the next npm release after the current published Guardex version, and any bundled Active Agents companion version exposed by that release SHALL be recorded alongside it.

#### Scenario: Prepare the next publishable npm patch release with companion-visible notes

- **GIVEN** the current Guardex package version is already the latest published release metadata in the repo and npm registry
- **AND** the shipped repo contains newer Active Agents companion changes that operators should see called out in the next release
- **WHEN** maintainers request the next npm version bump
- **THEN** `package.json` and `package-lock.json` SHALL be bumped to the next publishable semver
- **AND** `README.md` SHALL record the new release version with the shipped Active Agents companion improvements
- **AND** the live/template Active Agents manifests SHALL expose the companion version bundled by that release.

