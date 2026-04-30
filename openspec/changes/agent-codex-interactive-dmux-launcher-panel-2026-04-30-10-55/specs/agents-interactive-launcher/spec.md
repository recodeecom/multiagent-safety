## ADDED Requirements

### Requirement: Panel launches interactively on TTY

`gx agents start <task> --panel` SHALL open an interactive terminal launcher when stdin and stdout are TTYs.

#### Scenario: operator changes Codex account count before dry-run launch

- **WHEN** an operator runs `gx agents start "fix auth tests" --panel --codex-accounts 1 --dry-run` in a TTY
- **AND** presses `+`
- **AND** presses Enter
- **THEN** the command SHALL print dry-run plans for two Codex lanes
- **AND** it SHALL NOT create branches, worktrees, session metadata, or agent processes.

#### Scenario: scripted panel output stays static

- **WHEN** `gx agents start "fix auth tests" --panel --codex-accounts 3 --dry-run` runs without a TTY
- **THEN** the command SHALL keep printing the static panel and dry-run plans as before.

#### Scenario: operator cancels interactive panel

- **WHEN** an operator presses ESC or Ctrl-C in the interactive panel
- **THEN** the command SHALL exit with cancellation status
- **AND** it SHALL NOT create branches, worktrees, session metadata, or agent processes.
