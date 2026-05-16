## ADDED Requirements

### Requirement: successful self-update handoff
The CLI SHALL hand off cleanly to the installed version after a successful global self-update.

#### Scenario: newer package installed during the current invocation
- **WHEN** `gx` installs a newer global package version and verifies that the on-disk install matches the requested latest version
- **THEN** it restarts into the installed CLI instead of continuing to run the old in-memory process
- **AND** the user does not see stale CLI version output from the pre-update process.

### Requirement: stale-install verification remains guarded
The CLI SHALL continue to detect when `npm i -g @latest` exits successfully without updating the on-disk package.

#### Scenario: npm reports success but leaves old bytes on disk
- **WHEN** `@latest` returns status `0` but the installed package version still does not match the expected latest version
- **THEN** the CLI retries with the pinned latest version
- **AND** it only reports success after the on-disk install matches the expected version.
