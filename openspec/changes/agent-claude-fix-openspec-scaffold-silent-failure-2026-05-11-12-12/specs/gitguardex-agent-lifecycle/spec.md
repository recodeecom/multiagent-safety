# Spec Delta: gitguardex-agent-lifecycle

## ADDED Requirements

### Requirement: `gx branch start` MUST scaffold the OpenSpec change workspace by default

When `gx branch start` is invoked without an explicit `GUARDEX_OPENSPEC_AUTO_INIT` setting, and the resolved tier is `T1`, `T2`, or `T3`, the script MUST create the change workspace at `<worktree>/openspec/changes/<slug>/` with the tier-appropriate scaffold (`.openspec.yaml`, `proposal.md`, `tasks.md`, and for `T2`/`T3` also `specs/<capability>/spec.md`). The user MUST NOT have to set an environment variable for the workspace to materialize.

#### Scenario: Default invocation creates the change workspace

- **GIVEN** a fresh agent worktree being created via `gx branch start --tier T2 "<task>" "<agent>"`
- **AND** `GUARDEX_OPENSPEC_AUTO_INIT` is not set in the environment
- **WHEN** the script completes successfully
- **THEN** `<worktree>/openspec/changes/<slug>/proposal.md` exists
- **AND** `<worktree>/openspec/changes/<slug>/tasks.md` exists
- **AND** `<worktree>/openspec/changes/<slug>/.openspec.yaml` exists
- **AND** `<worktree>/openspec/changes/<slug>/specs/<capability>/spec.md` exists

#### Scenario: `--tier T0` still skips scaffolding regardless of the default

- **GIVEN** `gx branch start --tier T0 "<task>" "<agent>"`
- **WHEN** the script completes
- **THEN** no `openspec/changes/<slug>/` directory is created
- **AND** the end-of-run log says `OpenSpec change: skipped by tier T0`

#### Scenario: Explicit opt-out via env var

- **GIVEN** `GUARDEX_OPENSPEC_AUTO_INIT=false` is exported in the environment
- **WHEN** `gx branch start --tier T2 ...` runs
- **THEN** no `openspec/changes/<slug>/` directory is created
- **AND** the end-of-run log says `OpenSpec change: skipped (GUARDEX_OPENSPEC_AUTO_INIT disabled)`

### Requirement: `gx branch start` end-of-run log MUST accurately reflect scaffold state

The trailing log block in `templates/scripts/agent-branch-start.sh` MUST distinguish three cases for both the change and plan workspaces: `auto-init disabled`, `tier-skipped`, and `created at <path>`. The log MUST NOT claim a workspace was created when the corresponding `initialize_openspec_*_workspace` helper exited early.

#### Scenario: Log honesty when auto-init is disabled

- **GIVEN** `GUARDEX_OPENSPEC_AUTO_INIT=false` is set
- **WHEN** `gx branch start --tier T2` runs
- **THEN** the end-of-run log does NOT contain `OpenSpec change: openspec/changes/<slug>`
- **AND** the log contains `OpenSpec change: skipped (GUARDEX_OPENSPEC_AUTO_INIT disabled)`
- **AND** the log contains `OpenSpec plan: skipped (GUARDEX_OPENSPEC_AUTO_INIT disabled)`

#### Scenario: Log honesty when tier skips the change workspace

- **GIVEN** auto-init is enabled (default) and the tier is `T0`
- **WHEN** `gx branch start --tier T0 ...` runs
- **THEN** the log contains `OpenSpec change: skipped by tier T0`
- **AND** the log contains `OpenSpec plan: skipped by tier T0`
