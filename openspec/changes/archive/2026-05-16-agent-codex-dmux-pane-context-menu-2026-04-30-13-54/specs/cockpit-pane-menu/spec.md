## ADDED Requirements

### Requirement: Cockpit exposes a reusable dmux-style pane menu

GitGuardEx SHALL provide a terminal-only reusable pane menu model and renderer that mirrors the dmux pane action list while preserving Guardex safety boundaries.

#### Scenario: menu renders selected pane actions

- **GIVEN** a selected cockpit pane/session/worktree
- **WHEN** the pane menu is rendered
- **THEN** the title is `Menu: <selected pane/session/worktree name>`
- **AND** the menu shows View, Hide Pane, Close, Merge, Create GitHub PR, Rename, Copy Path, Open in Editor, Toggle Autopilot, Create Child Worktree, Browse Files, Add Terminal to Worktree, and Add Agent to Worktree
- **AND** the footer says `↑↓ to navigate • Enter or hotkey to select • ESC to cancel`

#### Scenario: menu key handling is deterministic

- **GIVEN** an open pane menu
- **WHEN** the user presses up/down, j/k navigation, Enter, a direct action hotkey, Escape, or Ctrl-C
- **THEN** pure menu state updates identify navigation, selected action id, or cancellation without terminal side effects

#### Scenario: actions stay pure until a backend task wires execution

- **GIVEN** a menu action requires branch or worktree context
- **WHEN** the pane menu model is rendered or keyed
- **THEN** it only reports enabled state, disabled reasons, cancellation, or selected action id
- **AND** it does not merge, create PRs, close panes, launch terminals, or mutate worktrees
