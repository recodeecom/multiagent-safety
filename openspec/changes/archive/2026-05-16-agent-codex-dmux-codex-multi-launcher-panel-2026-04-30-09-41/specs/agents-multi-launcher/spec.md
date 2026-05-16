## ADDED Requirements

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
