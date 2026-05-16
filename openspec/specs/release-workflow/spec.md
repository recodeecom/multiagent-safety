# release-workflow Specification

## Purpose
TBD - created by archiving change agent-codex-make-release-workflow-idempotent-when-ve-2026-04-21-16-30. Update Purpose after archive.
## Requirements
### Requirement: Release workflow skips already-published package versions
The `Release to npm (provenance)` workflow SHALL verify the package on every run, but it SHALL skip `npm publish` when the exact `package.json` version is already present on npm.

#### Scenario: workflow_dispatch on an already-published version
- **GIVEN** the workflow is running against a commit whose `package.json` version already exists on npm
- **WHEN** the verify steps complete successfully
- **THEN** the workflow SHALL detect that published version before the publish step
- **AND** it SHALL report that publish is being skipped instead of failing on `npm publish`.

### Requirement: `gx release` writes GitHub releases from README history
The maintainer-only `gx release` workflow SHALL generate the GitHub release body from the README release-notes history and SHALL create or update the GitHub release for the current package version instead of publishing to npm directly.

#### Scenario: aggregate the README changes since the last published release
- **GIVEN** `README.md` contains release sections for `v7.0.13`, `v7.0.14`, and `v7.0.15`
- **AND** GitHub already has `v7.0.12` as the latest published release before `v7.0.15`
- **WHEN** `gx release` runs for package version `7.0.15`
- **THEN** the generated GitHub release body SHALL include grouped sections for `v7.0.15`, `v7.0.14`, and `v7.0.13`
- **AND** it SHALL not collapse that range into only the patch-bump bullet from `v7.0.15`

#### Scenario: target the public GitHub repo even when `origin` drifts
- **GIVEN** the package manifest repository URL points at `git+https://github.com/recodeee/gitguardex.git`
- **AND** the local `origin` remote may point at a mirror or worktree-management repo
- **WHEN** `gx release` resolves the GitHub target repo
- **THEN** it SHALL use the public repo from the package manifest for release creation or updates

#### Scenario: update an existing release instead of failing
- **GIVEN** a GitHub release already exists for the current package tag
- **WHEN** `gx release` runs again for that same version
- **THEN** it SHALL update the release title/body with regenerated notes
- **AND** it SHALL not fail just because the release already exists

