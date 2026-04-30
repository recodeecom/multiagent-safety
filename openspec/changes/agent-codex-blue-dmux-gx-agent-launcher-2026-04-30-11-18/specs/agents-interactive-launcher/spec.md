## ADDED Requirements

### Requirement: Panel uses blue dmux-style terminal shell

`gx agents start <task> --panel` SHALL render a full-terminal GitGuardex launcher shell with a blue/cyan visual style, a left project rail, a matrix-style main field, and a centered GitGuardex welcome card.

#### Scenario: scripted panel output includes dmux shell

- **WHEN** `gx agents start "fix auth tests" --panel --codex-accounts 3 --dry-run` runs without a TTY
- **THEN** the output SHALL include a left `gitguardex` rail
- **AND** the output SHALL include a `Welcome` main field
- **AND** the output SHALL include `Press [n] or Enter to create a new agent`
- **AND** the command SHALL keep printing dry-run plans as before.

#### Scenario: TTY panel uses blue ANSI styling

- **WHEN** an operator runs `gx agents start "fix auth tests" --panel --codex-accounts 1 --dry-run` in a TTY
- **THEN** the interactive panel SHALL render with blue/cyan ANSI styling
- **AND** it SHALL preserve keyboard controls for navigation, toggling, Codex account count, launch, and cancel.

#### Scenario: operator launches with new-agent shortcut

- **WHEN** an operator presses `n` in the interactive panel
- **THEN** the command SHALL launch the selected agent plan the same way Enter does.
