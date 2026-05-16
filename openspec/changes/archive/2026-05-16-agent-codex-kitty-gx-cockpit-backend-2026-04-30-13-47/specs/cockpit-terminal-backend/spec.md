## ADDED Requirements

### Requirement: Cockpit terminal backend selection

`gx cockpit` SHALL accept `--backend kitty`, `--backend tmux`, and `--backend auto`.

#### Scenario: Auto prefers Kitty when available

- **WHEN** the operator runs `gx cockpit --backend auto`
- **AND** Kitty remote control is available
- **THEN** the cockpit SHALL select the Kitty backend.

#### Scenario: Auto falls back to tmux

- **WHEN** the operator runs `gx cockpit --backend auto`
- **AND** Kitty remote control is unavailable
- **THEN** the cockpit SHALL select the tmux backend.

### Requirement: Kitty cockpit command builders

The Kitty backend SHALL expose stable command builders for cockpit layout, agent pane, terminal pane, focus, close, and send-text operations.

#### Scenario: Cockpit layout command

- **WHEN** a cockpit layout is opened with Kitty
- **THEN** the backend SHALL build `kitty @ launch --type=window --cwd <repoRoot> --title "gx cockpit" ...`.

#### Scenario: Agent pane command

- **WHEN** an agent pane is launched with Kitty
- **THEN** the backend SHALL build `kitty @ launch --type=window --location=vsplit --cwd <worktree> --title <agent>`.

#### Scenario: Remote-control commands

- **WHEN** focus, close, or send-text is requested for a Kitty target id
- **THEN** the backend SHALL build `kitty @ focus-window --match id:<id>`, `kitty @ close-window --match id:<id>`, and `kitty @ send-text --match id:<id> --stdin`.

### Requirement: Tmux compatibility

The tmux cockpit path SHALL remain available through `gx cockpit --backend tmux` and keep existing tmux session behavior.

#### Scenario: Explicit tmux backend

- **WHEN** the operator runs `gx cockpit --backend tmux`
- **THEN** the cockpit SHALL create or attach the configured tmux session using the existing tmux session helpers.
