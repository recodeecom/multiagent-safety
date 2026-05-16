## ADDED Requirements

### Requirement: Pull request checks for protected main
The repository SHALL run CI and CodeQL workflows on pull requests targeting `main` so branch-protection rules can require real pre-merge status checks.

#### Scenario: CI runs on pull requests
- **WHEN** a pull request targets `main`
- **THEN** `.github/workflows/ci.yml` triggers for that pull request
- **AND** the workflow remains enabled for direct pushes to `main`.

#### Scenario: CodeQL runs on pull requests
- **WHEN** a pull request targets `main`
- **THEN** `.github/workflows/codeql.yml` triggers for that pull request
- **AND** the scheduled scan remains enabled.

### Requirement: Signed GitHub release assets
The release workflow SHALL publish signed GitHub release assets for the package tarball in addition to npm provenance.

#### Scenario: Release uploads signed artifacts
- **WHEN** `.github/workflows/release.yml` runs for a published release
- **THEN** it builds the npm tarball, generates a SHA256 checksum, creates a Sigstore bundle for the tarball, and uploads those files to the matching GitHub release
- **AND** the workflow continues to publish to npm with provenance when the version is not already published.

### Requirement: Pinned dependency and update metadata
The repository SHALL keep supply-chain metadata aligned with stricter Scorecard expectations.

#### Scenario: Package specs stay exact
- **WHEN** runtime or dev dependencies are declared in `package.json`
- **THEN** their versions are pinned exactly
- **AND** `package-lock.json` reflects those exact specifiers.

#### Scenario: Automated update coverage includes npm
- **WHEN** Dependabot configuration is evaluated
- **THEN** it schedules updates for both npm dependencies and GitHub Actions.

### Requirement: Security and ownership metadata points at this repository
Repository security and ownership metadata SHALL reference the live GitGuardex repository surfaces.

#### Scenario: Security reporting points at this repo
- **WHEN** maintainers or users read `SECURITY.md`
- **THEN** the private advisory link targets `recodeee/gitguardex`.

#### Scenario: Code owners cover default review paths
- **WHEN** repository-wide ownership is evaluated
- **THEN** `.github/CODEOWNERS` defines default owners for all files.
