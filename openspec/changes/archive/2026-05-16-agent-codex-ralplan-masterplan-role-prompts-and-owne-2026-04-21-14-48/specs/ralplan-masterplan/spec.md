## ADDED Requirements

### Requirement: Plan-backed sandboxes expose a masterplan identity
GuardeX plan-backed sandboxes SHALL include a `masterplan` label in the
generated worktree path and OpenSpec plan workspace slug whenever OpenSpec plan
bootstrap is enabled.

#### Scenario: agent-branch-start auto-bootstraps a shared planning lane
- **GIVEN** `scripts/agent-branch-start.sh` runs with `GUARDEX_OPENSPEC_AUTO_INIT=true`
- **WHEN** it creates the sandbox worktree and OpenSpec plan slug
- **THEN** the worktree path includes `agent__<role>__masterplan__`
- **AND** the plan folder slug starts with `agent-<role>-masterplan-`
- **AND** the change slug remains based on the original branch name.

### Requirement: Plan role folders ship with shareable helper prompts
Guardex plan workspaces SHALL scaffold each role folder with a default
`prompt.md` and ownership-oriented checklist sections so joined Codex helpers
can work inside the same owner branch/worktree safely.

#### Scenario: init-plan-workspace scaffolds role collaboration defaults
- **GIVEN** the user runs `scripts/openspec/init-plan-workspace.sh <plan-slug>`
- **WHEN** role folders are created for `planner`, `architect`, `critic`,
  `executor`, `writer`, and `verifier`
- **THEN** each role folder includes `prompt.md`
- **AND** each role `tasks.md` includes ownership, collaboration, and completion
  guidance in addition to the visible Spec/Tests/Implementation/Checkpoints sections
- **AND** the prompt instructs helpers to claim files in the owner lane and to
  leave cleanup to the owner change tasks 4.1-4.3.

### Requirement: codex-agent preserves masterplan labeling across safe fallback
`scripts/codex-agent.sh` SHALL preserve the same `masterplan` worktree/plan
labeling whether sandbox creation uses `agent-branch-start.sh` directly or the
safe fallback path.

#### Scenario: codex-agent falls back after an unsafe starter
- **GIVEN** the starter script switches the primary checkout or otherwise fails
  the safe sandbox checks
- **WHEN** `scripts/codex-agent.sh` creates the sandbox directly
- **THEN** the fallback worktree path still includes `agent__<role>__masterplan__`
- **AND** the fallback OpenSpec plan slug still starts with `agent-<role>-masterplan-`.
