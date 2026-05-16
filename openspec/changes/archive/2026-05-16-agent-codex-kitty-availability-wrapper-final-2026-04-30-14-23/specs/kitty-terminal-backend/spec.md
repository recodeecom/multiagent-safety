## ADDED Requirements

### Requirement: Kitty backend availability probes

The Kitty backend SHALL report available only after both the Kitty binary probe and Kitty remote-control probe succeed.

#### Scenario: Kitty binary missing

- **WHEN** the backend checks availability
- **AND** `kitty --version` fails
- **THEN** the backend SHALL report unavailable.

#### Scenario: Kitty remote control unavailable

- **WHEN** `kitty --version` succeeds
- **AND** `kitty @ ls` fails
- **THEN** the backend SHALL report unavailable with `Kitty is installed, but remote control is not available. Enable allow_remote_control in kitty.conf or run gx cockpit --backend tmux.`

#### Scenario: Kitty available

- **WHEN** `kitty --version` succeeds
- **AND** `kitty @ ls` succeeds
- **THEN** the backend SHALL report available.

### Requirement: Kitty backend status and dry-run

The Kitty backend SHALL expose `createKittyBackend({ runtime, env })`, `describe()`, and dry-run command plans without executing commands.

#### Scenario: Status description

- **WHEN** availability is described
- **THEN** the backend SHALL return readable installed, remote-control, availability, message, and check details.

#### Scenario: Dry-run plans

- **WHEN** the backend is created with `dryRun: true`
- **THEN** availability and action methods SHALL return planned Kitty commands without calling the runtime.
