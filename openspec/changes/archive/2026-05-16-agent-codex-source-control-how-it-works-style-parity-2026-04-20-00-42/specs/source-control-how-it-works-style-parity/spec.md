## ADDED Requirements

### Requirement: source-control-how-it-works-style-parity behavior
The tutorial UI SHALL render the Source Control and activity rail using the same visual direction as the existing "How it works" VS Code-style shell.

#### Scenario: Baseline acceptance
- **WHEN** source-control-how-it-works-style-parity behavior is exercised
- **THEN** the activity rail presents icon-based controls with a highlighted Source Control state
- **AND** the Source Control section header includes action glyph controls and a change-count badge.

### Requirement: worktree change status cues
The system SHALL present worktree file changes with explicit, color-coded status markers in the Source Control list.

#### Scenario: Status token rendering
- **WHEN** a worktree file entry starts with `M`, `U`, `D`, or `✓`
- **THEN** the status token is parsed into a dedicated marker column
- **AND** the marker receives the corresponding modified/added/removed/success tone
- **AND** all other tokens fall back to a neutral tone.
