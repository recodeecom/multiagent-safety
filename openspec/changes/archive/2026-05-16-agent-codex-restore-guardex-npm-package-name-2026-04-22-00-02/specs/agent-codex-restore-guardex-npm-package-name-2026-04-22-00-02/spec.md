## ADDED Requirements

### Requirement: Published npm package name stays on the existing guardex registry entry
The system SHALL publish and document the primary npm package as `@imdeadpool/guardex`.

#### Scenario: package metadata advertises the existing package
- **WHEN** the root `package.json` metadata is inspected
- **THEN** `name` equals `@imdeadpool/guardex`
- **AND** downstream package metadata snapshots use the same package name.

#### Scenario: the next release stays publishable on npm
- **WHEN** the package metadata is prepared for the next publish
- **THEN** the version is greater than the already-published `@imdeadpool/guardex@7.0.16`
- **AND** the package can publish without colliding with the existing registry version.

### Requirement: Install and update guidance references the real npm package
The README, tutorial UI, and self-update/install guidance SHALL use `@imdeadpool/guardex` while keeping GitGuardex as the product brand.

#### Scenario: install and self-update prompts use the restored package
- **WHEN** a user reads CLI install/setup guidance or the self-update flow
- **THEN** the npm command examples reference `@imdeadpool/guardex`
- **AND** the CLI keeps `gx`, `gitguardex`, and `guardex` command compatibility.

#### Scenario: docs and README-linked assets are aligned
- **WHEN** the README, tutorial page, Reddit kit, or README-linked SVG assets are inspected
- **THEN** install commands, npm badges, and package-name callouts reference `@imdeadpool/guardex`
- **AND** GitGuardex remains the visible product/repo name.
