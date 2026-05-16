## ADDED Requirements

### Requirement: OpenSpec change task scaffolds require cleanup completion
GuardeX-installed OpenSpec change workspaces SHALL include an explicit completion/cleanup
section in `tasks.md`.

#### Scenario: init-change-workspace scaffold creates default cleanup tasks
- **GIVEN** the user runs `scripts/openspec/init-change-workspace.sh <change-slug> <capability-slug>`
- **WHEN** `tasks.md` is created for that change
- **THEN** the file includes a final completion section that requires PR merge + sandbox cleanup
- **AND** it records PR URL + final `MERGED` state as completion evidence
- **AND** it requires either sandbox cleanup confirmation or a `BLOCKED:` handoff when cleanup is pending

### Requirement: setup and doctor refresh managed AGENTS cleanup policy
GuardeX SHALL treat the marker-managed `AGENTS.md` block as authoritative repair content during
`gx setup` and `gx doctor`.

#### Scenario: existing managed block drifts from the current cleanup contract
- **GIVEN** `AGENTS.md` contains the `multiagent-safety` markers and repo-owned text outside the managed block
- **WHEN** the user runs `gx setup --target <repo>` or `gx doctor --target <repo>`
- **THEN** GuardeX rewrites the managed block to the latest template policy
- **AND** it preserves repo-owned text outside the managed block
- **AND** the refreshed policy states that OpenSpec task scaffolds must include explicit cleanup + final `MERGED` evidence
