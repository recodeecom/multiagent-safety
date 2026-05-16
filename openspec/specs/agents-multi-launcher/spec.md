# agents-multi-launcher Specification

## Purpose
TBD - created by archiving change agent-codex-dmux-codex-multi-launcher-panel-2026-04-30-09-41. Update Purpose after archive.
## Requirements
### Requirement: terminal-style launcher panel

`gx agents start` SHALL support a terminal-style selection panel when the caller passes `--panel`.

#### Scenario: Render selected Codex account count

- **WHEN** an operator runs `gx agents start "fix auth tests" --panel --codex-accounts 3 --dry-run`
- **THEN** the output SHALL include a selection panel titled `Select Agent(s)`
- **AND** the panel SHALL show `Selected: 3/10`
- **AND** the panel SHALL show `Codex accounts: 3`.

### Requirement: repeated Codex launch planning

`gx agents start` SHALL support more than one Codex lane for the same task through `--count`, `--codex-count`, `--codex-accounts`, or `--agents codex:<count>`.

#### Scenario: Unique repeated Codex branch plans

- **WHEN** an operator dry-runs `gx agents start "fix auth tests" --agent codex --count 3 --dry-run`
- **THEN** Guardex SHALL produce three planned Codex branches
- **AND** each planned branch SHALL include a unique repeated-launch suffix
- **AND** each planned launch command SHALL preserve the original prompt text `fix auth tests`.

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

### Requirement: Panel launch uses Kitty terminal surface

`gx agents start --panel` SHALL keep the GitGuardex launcher shell behavior and open launched agent lanes in Kitty when terminal launch is enabled.

#### Scenario: Single panel launch opens Kitty

- **WHEN** an operator launches one selected agent from `gx agents start --panel`
- **THEN** Guardex SHALL create the `agent/*` lane and session metadata first
- **AND** SHALL write a Kitty session file for the created lane
- **AND** SHALL launch Kitty from that session file.

#### Scenario: Non-panel single launch remains non-terminal

- **WHEN** an operator runs a direct single-agent `gx agents start "fix auth"` without `--panel`
- **THEN** Guardex SHALL keep the existing branch/worktree/session behavior
- **AND** SHALL NOT open Kitty automatically.

### Requirement: Kitty sessions open the gx welcome tab first
Generated Kitty session files for panel-launched agent lanes SHALL open a gx welcome tab before any selected agent terminal tabs.

#### Scenario: Panel launch keeps welcome visible first
- **WHEN** `gx agents start --panel` launches selected agents through Kitty
- **THEN** the generated Kitty session file starts with a `gx welcome` tab rooted at the repo
- **AND** each selected agent lane opens in a later Kitty tab rooted at its worktree
- **AND** the first visible Kitty tab is the gx welcome tab.

