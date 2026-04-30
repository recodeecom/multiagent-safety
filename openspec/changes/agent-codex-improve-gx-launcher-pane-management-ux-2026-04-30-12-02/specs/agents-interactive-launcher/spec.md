## ADDED Requirements

### Requirement: Launcher Home Pane Management Guidance
The interactive `gx` launcher home SHALL present a bounded pane-management shortcut map that mirrors the existing `gx cockpit`/dmux actions while preserving the agent selection workflow.

#### Scenario: Empty launcher home
- **WHEN** `gx agents start --panel --dry-run` is rendered without a task
- **THEN** the panel shows task-entry guidance
- **AND** the panel shows pane-management shortcuts including terminal, files, and `Alt+Shift+M` pane menu guidance
- **AND** no branch or worktree plan is emitted before a task exists.

#### Scenario: Shortcut help while entering a task
- **WHEN** the launcher is in task-entry mode
- **AND** the user presses `?`
- **THEN** the task text remains unchanged
- **AND** the launcher reports that the shortcut map is visible on the right.

#### Scenario: Cockpit-only pane actions
- **WHEN** the launcher is in agent-selection mode
- **AND** the user presses a cockpit-only pane action such as `t` or `Alt+Shift+M`
- **THEN** the launcher keeps the current selection state
- **AND** reports guidance that the action is available from `gx cockpit`.
