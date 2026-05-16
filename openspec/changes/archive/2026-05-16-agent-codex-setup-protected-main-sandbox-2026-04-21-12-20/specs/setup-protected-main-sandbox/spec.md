## ADDED Requirements

### Requirement: protected-main setup refresh uses a sandbox worktree

After a repo is already bootstrapped, `gx setup` SHALL avoid hard-blocking on protected `main` and SHALL reuse an isolated sandbox worktree to perform the managed refresh.

#### Scenario: rerunning setup on initialized protected main

- **GIVEN** a repo on protected `main` that already has Guardex bootstrap files
- **WHEN** the user runs `gx setup --target <repo>`
- **THEN** the command succeeds without requiring `--allow-protected-base-write`
- **AND** the visible base checkout remains on `main`
- **AND** the managed Guardex bootstrap files are refreshed in the base workspace
- **AND** the temporary sandbox worktree/branch is pruned before setup exits
