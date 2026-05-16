## ADDED Requirements

### Requirement: integration merge runs inside an agent worktree
GitGuardex SHALL merge overlapping `agent/*` branches inside an integration `agent/*` branch/worktree instead of merging directly on the protected base branch.

#### Scenario: create a fresh integration lane
- **WHEN** a user runs `gx merge` with one or more `--branch agent/...` inputs and no `--into`
- **THEN** the system creates a new integration `agent/*` branch/worktree from the configured base branch
- **AND** all requested merges run inside that integration worktree
- **AND** the command prints the integration branch and worktree path.

#### Scenario: reuse an existing owner lane
- **WHEN** a user runs `gx merge --into <agent-branch>` with additional source branches
- **THEN** the system reuses that owner branch as the merge target
- **AND** it refuses to proceed if the target worktree has uncommitted changes or an in-progress merge operation.

### Requirement: overlapping file edits are reported before merge
GitGuardex SHALL detect and report files changed by more than one requested source branch before applying the merges.

#### Scenario: overlapping implementation files exist
- **WHEN** two or more requested source branches changed the same file relative to the merge base
- **THEN** the command prints each overlapping file
- **AND** it identifies the source branches that changed that file
- **AND** it still allows the user to continue into the integration lane unless another hard preflight check fails.

### Requirement: conflicts stop with resumable guidance
GitGuardex SHALL stop on merge conflicts inside the integration worktree and provide resumable next-step guidance without mutating the protected base branch.

#### Scenario: sequential merge hits a conflict
- **WHEN** `gx merge` successfully merges earlier source branches and then encounters a conflict on a later source branch
- **THEN** the command exits non-zero
- **AND** it prints the target integration branch/worktree, the source branch that conflicted, and the conflicting files
- **AND** it tells the user how to resolve or abort the conflict inside the integration worktree
- **AND** it prints the remaining branches so the merge sequence can be resumed intentionally afterward.

### Requirement: setup-managed repos receive the merge workflow
GitGuardex setup/doctor SHALL install the managed merge workflow files and package script entry needed to run `gx merge`.

#### Scenario: setup bootstraps a repo
- **WHEN** `gx setup` or `gx doctor --repair` installs managed workflow files
- **THEN** the repo contains `scripts/agent-branch-merge.sh`
- **AND** the repo package scripts include a stable merge entry point for the managed workflow.
