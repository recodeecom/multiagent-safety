## ADDED Requirements

### Requirement: sync-how-it-works-design-logic-codex behavior
The GuardeX frontend tutorial page SHALL mirror the current How-it-works workflow branding and controls used for Codex-based walkthroughs.

#### Scenario: Codex branding parity in the tutorial shell
- **WHEN** the tutorial page is rendered in `guardex-agent-work-tree-managment/frontend`
- **THEN** the chat label shows `CHAT • CODEX`
- **AND** the editor header identifies `guardex-agent-work-tree-managment — VS Code`
- **AND** the header includes GuardeX + Codex workflow context.

#### Scenario: Close action resets walkthrough state
- **WHEN** a user activates the close control in the top bar
- **THEN** the page resets to execute mode
- **AND** the active step returns to the first step.

#### Scenario: Keyboard navigation parity
- **WHEN** a user presses `ArrowRight` or `ArrowLeft`
- **THEN** the walkthrough moves to the next or previous step within bounds
- **AND** pressing `Escape` resets the walkthrough to execute mode step 1.
