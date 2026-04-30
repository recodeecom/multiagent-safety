## ADDED Requirements

### Requirement: Kitty external terminal launcher

`gx agents start` SHALL use `kitty` as the default external terminal launcher for multi-agent starts while preserving the existing branch, worktree, lock, and PR-only finish safety model.

#### Scenario: Multi-agent start launches Kitty after lanes exist

- **WHEN** an operator starts more than one agent lane with `gx agents start "fix auth tests" --panel --codex-accounts 3 --base main`
- **THEN** Guardex SHALL create each `agent/*` lane before terminal launch
- **AND** SHALL write a Kitty session file containing each lane worktree and launch command
- **AND** SHALL launch one Kitty window from that session file.

#### Scenario: Terminal launch disabled

- **WHEN** an operator passes `--terminal none`
- **THEN** Guardex SHALL create the requested lanes
- **AND** SHALL skip external terminal launch.

#### Scenario: Kitty unavailable

- **WHEN** Kitty is not available on PATH
- **THEN** Guardex SHALL keep created lanes and session metadata intact
- **AND** SHALL print the Kitty session file path and recovery command.
