# setup-protected-main-sandbox Specification

## Purpose
TBD - created by archiving change agent-codex-setup-protected-main-sandbox-2026-04-21-12-02. Update Purpose after archive.
## Requirements
### Requirement: Protected-main setup/install/fix use sandbox branches
When `gx setup`, `gx install`, or `gx fix` targets a protected `main` checkout, the command SHALL execute the maintenance work in a sandbox branch/worktree instead of writing directly onto the visible protected-base checkout.

#### Scenario: First-time setup on protected main
- **GIVEN** a repo is on protected `main` and Guardex bootstrap files do not exist yet
- **WHEN** the user runs `gx setup`
- **THEN** Guardex creates a sandbox branch/worktree for the bootstrap run
- **AND** the visible protected `main` checkout stays on `main` with no tracked-file dirt.

#### Scenario: Protected-main alias commands follow the same sandbox rule
- **GIVEN** a repo is on protected `main`
- **WHEN** the user runs `gx install` or `gx fix`
- **THEN** Guardex runs the requested maintenance command in a sandbox branch/worktree
- **AND** it does not fail only because the visible checkout is on protected `main`.

#### Scenario: Sandbox cleanup only happens when safe
- **GIVEN** sandboxed maintenance completed on protected `main`
- **WHEN** Guardex cannot auto-finish the sandbox branch through the PR flow
- **THEN** the sandbox branch/worktree remains available for follow-up
- **AND** Guardex only auto-cleans the sandbox when there are no changes to keep or the finish flow completed successfully.

### Requirement: protected-main setup refresh uses a sandbox worktree

After a repo is already bootstrapped, `gx setup` SHALL avoid hard-blocking on protected `main` and SHALL reuse an isolated sandbox worktree to perform the managed refresh.

#### Scenario: rerunning setup on initialized protected main

- **GIVEN** a repo on protected `main` that already has Guardex bootstrap files
- **WHEN** the user runs `gx setup --target <repo>`
- **THEN** the command succeeds without requiring `--allow-protected-base-write`
- **AND** the visible base checkout remains on `main`
- **AND** the managed Guardex bootstrap files are refreshed in the base workspace
- **AND** the temporary sandbox worktree/branch is pruned before setup exits

