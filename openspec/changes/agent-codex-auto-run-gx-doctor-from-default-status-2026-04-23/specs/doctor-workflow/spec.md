## ADDED Requirements

### Requirement: bare `gx` can hand off directly into doctor repair
The default no-argument `gx` entrypoint SHALL be able to hand off directly into `gx doctor` when repo safety is degraded and auto-repair is enabled for the current session.

#### Scenario: degraded bare `gx` auto-runs doctor in auto-repair mode
- **GIVEN** bare `gx` runs against a repo whose safety service is degraded
- **AND** auto-repair is enabled for the current session
- **WHEN** the default status summary finishes rendering
- **THEN** the CLI SHALL print an explicit auto-repair handoff line
- **AND** it SHALL run the same doctor workflow a human would get from `gx doctor`
- **AND** the resulting exit code SHALL match that doctor run

#### Scenario: status-only degraded bare `gx` stays non-mutating when auto-repair is disabled
- **GIVEN** bare `gx` runs against a degraded repo
- **AND** auto-repair is disabled for the current session
- **WHEN** the default status summary renders
- **THEN** the CLI SHALL remain status-only and SHALL NOT run doctor automatically
- **AND** it SHALL tell the human to run `gx doctor` for repair

### Requirement: auto-doctor handoff stays visibly active
When bare `gx` auto-starts doctor in human-readable mode, the handoff SHALL stay visibly active instead of appearing frozen.

#### Scenario: auto-doctor startup shows transient progress before doctor output starts
- **GIVEN** bare `gx` is auto-starting `gx doctor` in a human shell
- **WHEN** the doctor subprocess has not emitted its first output yet
- **THEN** the CLI SHALL show a transient progress indicator for the doctor handoff
- **AND** that indicator SHALL clear once doctor output begins or the subprocess exits
