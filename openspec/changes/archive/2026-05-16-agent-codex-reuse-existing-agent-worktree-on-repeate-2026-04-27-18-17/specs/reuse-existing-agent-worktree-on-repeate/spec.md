## ADDED Requirements

### Requirement: Branch start reuses current agent worktree
When `gx branch start` runs from a worktree whose current branch starts with `agent/`, the command SHALL reuse that existing branch and worktree by default instead of creating another timestamped branch/worktree from it.

#### Scenario: Follow-up agent starts inside an existing sandbox
- **GIVEN** the current working tree is an agent worktree on branch `agent/codex/example`
- **WHEN** `gx branch start "continue work" "codex"` is run from that worktree
- **THEN** the command reports `Reusing existing branch: agent/codex/example`
- **AND** the reported worktree path is the current worktree
- **AND** no nested agent worktree is created.

### Requirement: Branch start keeps an explicit new-lane escape hatch
When a caller intentionally needs a child or parallel lane from inside an existing agent worktree, the command SHALL provide an explicit option to bypass reuse and create a new branch/worktree.

#### Scenario: Caller opts out of reuse
- **GIVEN** the current working tree is an agent worktree
- **WHEN** `gx branch start --new "parallel work" "codex"` is run
- **THEN** the command may create a new isolated branch/worktree using the existing startup behavior.
