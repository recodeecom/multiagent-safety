## ADDED Requirements

### Requirement: Worktree-first Active Agents rows

The VS Code `gitguardex.activeAgents` view MUST group agent session rows under their owning worktree rows before rendering session-owned file details.

#### Scenario: ACTIVE AGENTS shows worktree rows inside activity groups

- **GIVEN** the companion reads one or more live sessions for the same repo
- **WHEN** it renders an activity bucket such as `WORKING NOW` or `THINKING`
- **THEN** each child row under that bucket is a worktree row derived from `worktreePath`
- **AND** expanding the worktree row reveals the agent/session rows for that worktree
- **AND** expanding a session row reveals that session's touched-file rows.

#### Scenario: CHANGES shows worktree rows before session-owned files

- **GIVEN** repo changes belong to managed agent worktrees
- **WHEN** the companion renders `CHANGES`
- **THEN** it groups those changes under worktree rows first
- **AND** expanding a worktree row reveals the owning session row
- **AND** expanding that session row reveals the localized changed-file rows
- **AND** files not owned by any active worktree remain under `Repo root`.
