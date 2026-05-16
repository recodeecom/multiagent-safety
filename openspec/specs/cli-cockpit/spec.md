# cli-cockpit Specification

## Purpose
TBD - created by archiving change agent-codex-plain-gx-cockpit-welcome-2026-05-01-00-21. Update Purpose after archive.
## Requirements
### Requirement: plain interactive gx opens cockpit

Guardex SHALL route a no-argument `gx` invocation from an interactive terminal to the GitGuardex cockpit control view.

#### Scenario: interactive no-argument launch

- **GIVEN** stdin and stdout are TTYs
- **AND** `GUARDEX_LEGACY_STATUS` is not enabled
- **WHEN** the user runs `gx`
- **THEN** Guardex SHALL open the cockpit control view instead of printing status output.

#### Scenario: non-interactive no-argument launch

- **GIVEN** stdin or stdout is not a TTY
- **WHEN** the user runs `gx`
- **THEN** Guardex SHALL print the existing compact status output.

#### Scenario: legacy status escape hatch

- **GIVEN** stdin and stdout are TTYs
- **AND** `GUARDEX_LEGACY_STATUS=1`
- **WHEN** the user runs `gx`
- **THEN** Guardex SHALL print the existing status output instead of opening the cockpit.

#### Scenario: explicit status command

- **WHEN** the user runs `gx status`
- **THEN** Guardex SHALL print status output.

### Requirement: default cockpit launch falls back safely

Guardex SHALL prefer Kitty for the default interactive cockpit launch when Kitty remote control is available, then fall back to tmux, then fall back to an inline cockpit control render.

#### Scenario: Kitty unavailable

- **GIVEN** Kitty remote control is unavailable
- **WHEN** the default cockpit launcher runs
- **THEN** Guardex SHALL try the tmux cockpit backend.

#### Scenario: terminal backends unavailable

- **GIVEN** Kitty and tmux cockpit launch both fail
- **WHEN** the default cockpit launcher runs
- **THEN** Guardex SHALL render the cockpit control view inline in the current terminal.

### Requirement: cockpit opens a repo tmux session

Guardex SHALL provide a `gx cockpit` command that creates or attaches to a tmux session for the resolved repo root.

#### Scenario: missing default session

- **GIVEN** tmux is installed
- **AND** the default `guardex` session does not exist
- **WHEN** the user runs `gx cockpit`
- **THEN** Guardex SHALL create the `guardex` tmux session with its working directory set to the repo root
- **AND** the initial pane SHALL run `gx agents status`
- **AND** Guardex SHALL NOT launch agents or install cockpit keyboard shortcuts.

#### Scenario: named missing session with attach requested

- **GIVEN** tmux is installed
- **AND** the requested session does not exist
- **WHEN** the user runs `gx cockpit --session guardex --attach`
- **THEN** Guardex SHALL create the requested tmux session in the repo root
- **AND** Guardex SHALL attach to it after creation.

#### Scenario: existing session

- **GIVEN** tmux is installed
- **AND** the requested tmux session exists
- **WHEN** the user runs `gx cockpit`
- **THEN** Guardex SHALL attach to the existing session
- **AND** Guardex SHALL NOT create a duplicate session.

#### Scenario: tmux unavailable

- **GIVEN** tmux is not available on PATH
- **WHEN** the user runs `gx cockpit`
- **THEN** Guardex SHALL print a helpful error telling the user tmux is required.

