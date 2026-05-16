## ADDED Requirements

### Requirement: setup-managed repos receive the richer change scaffold
Guardex setup-managed repos SHALL receive the same richer OpenSpec change scaffold already present in `recodee`.

#### Scenario: full change scaffold is initialized
- **GIVEN** a repo managed by `gx setup` or `gx doctor`
- **WHEN** the operator runs `scripts/openspec/init-change-workspace.sh <change-slug> <capability-slug>`
- **THEN** the script writes `.openspec.yaml`, `proposal.md`, `tasks.md`, and `specs/<capability>/spec.md`
- **AND** `tasks.md` includes Definition-of-Done language plus explicit cleanup and merge evidence steps.

#### Scenario: minimal T1 scaffold is initialized
- **GIVEN** `GUARDEX_OPENSPEC_MINIMAL=1`
- **WHEN** the operator runs `scripts/openspec/init-change-workspace.sh <change-slug> <capability-slug> <agent-branch>`
- **THEN** the script creates `.openspec.yaml` and `notes.md` without the full change bundle
- **AND** `notes.md` records the provided agent branch placeholder plus cleanup expectations.

### Requirement: setup-managed repos receive the richer plan scaffold
Guardex setup-managed repos SHALL receive the same richer OpenSpec plan scaffold already present in `recodee`.

#### Scenario: plan workspace is initialized
- **GIVEN** a repo managed by `gx setup` or `gx doctor`
- **WHEN** the operator runs `scripts/openspec/init-plan-workspace.sh <plan-slug>`
- **THEN** the script creates summary, checkpoint, and root plan artifacts for the workspace
- **AND** it creates coordinator, kickoff, and phases artifacts
- **AND** each default role receives proposal, spec, and task scaffolds that preserve Spec, Tests, Implementation, Checkpoints, Collaboration, and Cleanup structure.
