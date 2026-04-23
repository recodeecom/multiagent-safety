## ADDED Requirements

### Requirement: raw Active Agents worktree rows stay task-first

The VS Code Active Agents raw tree SHALL prefer a readable task label and compact worktree summary instead of the managed worktree folder basename when a worktree represents a single active session.

#### Scenario: single-session worktree group

- **WHEN** the raw Active Agents tree renders a managed worktree that contains one tracked session
- **THEN** the worktree row uses the session task name as its label
- **AND** the description shows compact agent/file/lock summary text
- **AND** the tooltip still exposes the full worktree path and full branch ref.

### Requirement: raw Active Agents branch rows stay compact but identifiable

The VS Code Active Agents raw tree SHALL render readable branch rows that preserve operator context without repeating the full `agent/...` ref in the visible label.

#### Scenario: raw branch row

- **WHEN** the raw Active Agents tree renders a session row under a worktree group
- **THEN** the row label uses a compact owner/task branch label
- **AND** the row description starts with a capitalized session status and compact file summary wording like `Working · 3 files`
- **AND** the tooltip still includes the full branch ref.
