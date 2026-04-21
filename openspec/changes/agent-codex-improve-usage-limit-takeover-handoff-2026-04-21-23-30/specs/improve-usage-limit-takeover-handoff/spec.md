## ADDED Requirements

### Requirement: `codex-agent` SHALL emit a takeover prompt when a sandbox is kept
`codex-agent` SHALL print a copy-paste takeover prompt whenever it leaves a
branch/worktree alive for manual follow-up.

#### Scenario: incomplete run keeps the sandbox alive
- **GIVEN** `codex-agent` keeps the sandbox because auto-finish did not complete
- **WHEN** it reports the kept worktree
- **THEN** it SHALL print a takeover prompt that references the existing branch
  and sandbox path
- **AND** the prompt SHALL tell the next agent to continue from the current
  state instead of creating a new sandbox
- **AND** the prompt SHALL include the cleanup/finish command for
  `agent-branch-finish.sh`.

### Requirement: OpenSpec change scaffolds SHALL include structured takeover copy
OpenSpec change workspaces SHALL scaffold a structured handoff line plus a
copy-paste takeover prompt for usage-limit/manual handoffs.

#### Scenario: standard change workspace scaffold
- **WHEN** `scripts/openspec/init-change-workspace.sh` creates a non-minimal
  change workspace
- **THEN** `tasks.md` SHALL include a `Handoff:` line and a `Copy prompt:` line
- **AND** the generated cleanup command SHALL resolve the branch base from repo
  metadata when available.

#### Scenario: minimal notes workspace scaffold
- **WHEN** `scripts/openspec/init-change-workspace.sh` runs in minimal mode
- **THEN** `notes.md` SHALL include the same `Handoff:` and `Copy prompt:` flow
- **AND** the generated cleanup command SHALL resolve the branch base from repo
  metadata when available.
