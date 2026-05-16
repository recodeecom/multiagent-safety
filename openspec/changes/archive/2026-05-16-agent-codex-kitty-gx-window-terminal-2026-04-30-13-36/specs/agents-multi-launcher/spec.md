## ADDED Requirements

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
