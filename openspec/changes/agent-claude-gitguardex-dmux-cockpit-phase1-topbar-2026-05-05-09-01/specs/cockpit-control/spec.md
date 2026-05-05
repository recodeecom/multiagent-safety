## ADDED Requirements

### Requirement: Cockpit exposes a dmux-style 4-action shortcut row
The cockpit sidebar SHALL render a dmux-style shortcut block with at
least four primary actions: `[n]ew agent`, `[t]erminal`, `[l]ogs`,
`[p]rojects`, plus the existing `[s]ettings` and `[?] shortcuts`.

#### Scenario: Sidebar renders all four primary shortcuts
- **WHEN** `renderSidebar` is invoked with any state
- **THEN** the rendered output contains `[n]ew agent`, `[t]erminal`,
  `[l]ogs`, `[p]rojects`, `[s]ettings`, and `[?] shortcuts` substrings.

### Requirement: Cockpit dispatches `l` to a logs mode and `p` to a projects mode
The cockpit key handler SHALL route the `l` key to the `logs` mode
unconditionally, and SHALL route the `p` key to the `projects` mode
when no lane is selected. When a lane is selected, `p` SHALL keep its
existing pane-menu meaning (Create GitHub PR).

#### Scenario: l opens the logs panel
- **WHEN** the cockpit is in `main` mode and the user presses `l`
- **THEN** the resulting state has `mode === 'logs'` and
  `lastIntent === null`.

#### Scenario: p opens projects when no lane is selected
- **WHEN** the cockpit is in `main` mode with `selectedScope === 'action'`
  and the user presses `p`
- **THEN** the resulting state has `mode === 'projects'`.

#### Scenario: p preserves the pane-menu action when a lane is selected
- **WHEN** the cockpit is in `main` mode with at least one lane selected
  and the user presses `p`
- **THEN** the resulting state SHALL NOT have `mode === 'projects'`
- **AND** the existing pane-menu PR action SHALL fire.

#### Scenario: Esc returns from logs/projects to main
- **WHEN** the cockpit is in `logs` or `projects` mode and the user
  presses `Esc`
- **THEN** the resulting state has `mode === 'main'`.

### Requirement: Logs and projects modes have placeholder render panels
The cockpit SHALL render a placeholder panel for the `logs` and
`projects` modes describing what later phases will fill in, so that
pressing `l` or `p` produces visible feedback before the real overlays
ship.

#### Scenario: Logs panel renders a heading and filter row
- **WHEN** `renderPanel` is invoked with `mode === 'logs'`
- **THEN** the output contains a `gitguardex logs` heading
- **AND** the output contains the substring `[1] All  [2] Info  [3]
  Warnings  [4] Errors  [5] By Pane`.

#### Scenario: Projects panel renders a heading and switch hint
- **WHEN** `renderPanel` is invoked with `mode === 'projects'`
- **THEN** the output contains a `projects` heading
- **AND** the output contains an `Enter: switch to selected project`
  hint.
