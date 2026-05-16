## ADDED Requirements

### Requirement: finish helper worktrees stay outside durable agent roots

`gx branch finish` SHALL create temporary `__source-probe-*` and `__integrate-*` helper worktrees under a runtime-scoped internal temp root (`.omx/.tmp-worktrees` for Codex lanes, `.omc/.tmp-worktrees` for Claude lanes) instead of the user-visible `.omx/agent-worktrees` or `.omc/agent-worktrees` roots.

#### Scenario: Codex finish helper path stays outside `.omx/agent-worktrees`

- **GIVEN** a Codex agent branch whose stored Guardex worktree root is `.omx/agent-worktrees`
- **WHEN** `gx branch finish` creates a temporary source-probe or integration helper worktree
- **THEN** the helper worktree path starts under `.omx/.tmp-worktrees`
- **AND** the helper worktree path does not start under `.omx/agent-worktrees`

#### Scenario: Claude finish helper path stays outside `.omc/agent-worktrees`

- **GIVEN** a Claude agent branch whose stored Guardex worktree root is `.omc/agent-worktrees`
- **WHEN** `gx branch finish` creates a temporary source-probe or integration helper worktree
- **THEN** the helper worktree path starts under `.omc/.tmp-worktrees`
- **AND** the helper worktree path does not start under `.omc/agent-worktrees`

### Requirement: cleanup removes stale temporary helper refs

`gx cleanup` and the finish exit path SHALL remove stale temporary helper refs (`__agent_integrate_*`, `__source-probe-*`) even when the matching helper worktree is already gone.

#### Scenario: stale temporary integration ref is swept without a worktree

- **GIVEN** a repo still has a local `__agent_integrate_*` branch ref
- **AND** no worktree is attached to that ref anymore
- **WHEN** `gx cleanup --delete-branches` runs
- **THEN** the stale temporary ref is deleted

### Requirement: repo scan ignores cover internal temp helper roots

Guardex-managed VS Code repo scan ignores SHALL include `.omx/.tmp-worktrees` and `.omc/.tmp-worktrees` alongside the durable agent worktree roots.

#### Scenario: setup appends temp helper roots to repo scan ignores

- **GIVEN** `.vscode/settings.json` already has user-defined `git.repositoryScanIgnoredFolders`
- **WHEN** `gx setup` or `gx doctor` refreshes the managed settings
- **THEN** the existing user-defined entries remain
- **AND** the resulting ignore list includes `.omx/.tmp-worktrees`, `**/.omx/.tmp-worktrees`, `.omc/.tmp-worktrees`, and `**/.omc/.tmp-worktrees`

### Requirement: explicit PR mode skips temporary integration helpers

`gx branch finish` SHALL skip creating temporary `__integrate-*` worktrees and refs when the operator explicitly selects PR-only finish mode (`--mode pr` or `--via-pr`).

#### Scenario: PR-only finish merges without an integration helper worktree

- **GIVEN** an agent branch is finished with `--mode pr` or `--via-pr`
- **AND** the source branch already has a normal attached worktree
- **WHEN** `gx branch finish` prepares the PR flow
- **THEN** it does not create a temporary `__integrate-*` worktree
- **AND** it does not create a temporary `__agent_integrate_*` ref
- **AND** the PR flow still pushes the source branch and opens or merges the PR
