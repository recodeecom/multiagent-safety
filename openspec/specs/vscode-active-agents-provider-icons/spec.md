# vscode-active-agents-provider-icons Specification

## Purpose
TBD - created by archiving change agent-codex-add-openspec-and-provider-icons-2026-04-23-14-02. Update Purpose after archive.
## Requirements
### Requirement: Active Agents rows show provider-aware working state

Active Agents session rows SHALL surface provider identity for Codex/OpenAI and Claude sessions without sacrificing higher-priority warning badges.

#### Scenario: Codex session shows OpenAI branding in the row

- **GIVEN** an active session record whose CLI or agent identity resolves to Codex/OpenAI
- **WHEN** the Active Agents tree renders the session row
- **THEN** the row description includes `OpenAI`
- **AND** the session decoration exposes an `AI` badge whenever no blocked/dead/stalled/idle-threshold badge overrides it

#### Scenario: Snapshot session shows the snapshot name and badge

- **GIVEN** an active session or managed worktree telemetry record carries snapshot identity such as `nagyviktor@edixa.com`
- **WHEN** the Active Agents tree renders the session row
- **THEN** the row description includes the snapshot name
- **AND** the session decoration exposes the first alphanumeric snapshot initial, such as `N`, ahead of provider-only badges

#### Scenario: Claude session shows Claude branding in the row

- **GIVEN** an active session record whose CLI or agent identity resolves to Claude
- **WHEN** the Active Agents tree renders the session row
- **THEN** the row description includes `Claude`
- **AND** the session decoration exposes a `CL` badge whenever no blocked/dead/stalled/idle-threshold badge overrides it

#### Scenario: Raw agent branch groups use branch presentation

- **GIVEN** the Active Agents raw tree groups sessions by worktree branch
- **WHEN** a worktree group is rendered
- **THEN** the row uses the VS Code `git-branch` icon instead of the generic folder icon
- **AND** the row description includes the current state plus agent name, such as `working: codex`

### Requirement: Bundled Explorer file icon theme highlights repo workflow surfaces

The shipped VS Code companion SHALL bundle an optional file icon theme that gives workflow-critical repo paths distinct Explorer icons.

#### Scenario: OpenSpec and workflow folders receive semantic icons

- **GIVEN** the bundled `GitGuardex File Icons` theme is selected in VS Code
- **WHEN** the Explorer renders folders named `changes`, `plan`, `specs`, `.agents`, `agent-worktrees`, `.githooks`, or `rules`
- **THEN** each folder uses a bundled semantic icon instead of the generic default

#### Scenario: Key workflow files receive semantic icons

- **GIVEN** the bundled `GitGuardex File Icons` theme is selected in VS Code
- **WHEN** the Explorer renders workflow files such as `AGENTS.md`, `CLAUDE.md`, `proposal.md`, `tasks.md`, `plan.md`, `spec.md`, `config.yaml`, `.openspec.yaml`, `context-docs-cue.md`, `pre-commit`, `pre-push`, or `post-checkout`
- **THEN** each file uses the corresponding bundled semantic icon

#### Scenario: Install bundle ships the icon theme assets

- **GIVEN** maintainers install the workspace extension bundle through `scripts/install-vscode-active-agents-extension.js`
- **WHEN** the extension payload is copied into the VS Code extensions directory
- **THEN** the installed bundle contains the icon-theme manifest plus the SVG assets referenced by it

### Requirement: Active Agents raw tree uses bundled workflow icons

The Active Agents raw tree SHALL use bundled semantic workflow icons for OpenSpec folders and files when no higher-priority status icon override applies.

#### Scenario: OpenSpec folders use semantic icons in the raw tree

- **GIVEN** the Active Agents raw tree renders OpenSpec folder nodes such as `changes` and `specs`
- **WHEN** those tree items are displayed
- **THEN** `changes` uses the bundled OpenSpec icon asset
- **AND** `specs` uses the bundled spec icon asset

#### Scenario: OpenSpec files use semantic icons in the raw tree

- **GIVEN** the Active Agents raw tree renders `proposal.md`, `tasks.md`, or `spec.md` nodes without lock/warning overrides
- **WHEN** those file items are displayed
- **THEN** each node uses the bundled semantic icon asset that matches the shipped file-icon manifest

#### Scenario: Warning icons still override bundled file icons

- **GIVEN** an Active Agents change row carries an explicit warning icon or foreign-lock warning state
- **WHEN** that row is rendered
- **THEN** the warning icon remains visible instead of a bundled workflow file icon

### Requirement: Changed OpenSpec rows keep semantic file icons

The Active Agents tree SHALL keep semantic OpenSpec file icons for changed rows when the row only carries delta metadata and no real warning state.

#### Scenario: Delta-only proposal, tasks, and spec rows keep semantic icons

- **GIVEN** an unassigned Active Agents change row points at `proposal.md`, `tasks.md`, or `spec.md`
- **AND** the row only carries normal change metadata such as `deltaLabel: Updated`
- **WHEN** the tree renders that row
- **THEN** the row keeps the bundled semantic icon that matches the shipped file-icon manifest
- **AND** the description still surfaces the delta label

#### Scenario: Warning states still override semantic file icons

- **GIVEN** an Active Agents change row is on a protected branch, has a foreign lock, or carries a lock warning
- **WHEN** the tree renders that row
- **THEN** the row continues to use the generic warning icon instead of a semantic workflow file icon

