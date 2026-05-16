# codex-task Specification

## Purpose
TBD - created by archiving change agent-codex-codex-task-2026-05-11-12-44. Update Purpose after archive.
## Requirements
### Requirement: Guardex Codex sessions default to no approval prompts
Guardex Codex launcher sessions SHALL pass an approval policy of `never` to Codex unless the caller supplied an approval policy explicitly or disabled the default.

#### Scenario: Default launcher invocation
- **WHEN** `scripts/codex-agent.sh` launches Codex without an approval policy argument
- **THEN** Codex is invoked with `-a never`.

#### Scenario: Explicit caller override
- **WHEN** `scripts/codex-agent.sh` receives an approval policy argument from the caller
- **THEN** the launcher SHALL NOT add a second default `-a never` argument.

#### Scenario: Conflict review relaunch
- **WHEN** the launcher starts a Codex conflict-review pass
- **THEN** the same default approval policy handling applies.

### Requirement: Local PR Review Runner
The system SHALL provide a `gx pr-review` command that reviews a GitHub pull request using an authenticated local agent CLI without requiring OpenAI or Anthropic API tokens.

#### Scenario: Review with GitHub posting
- **WHEN** `gx pr-review --provider codex --pr <number> --post` runs in a repository with GitHub auth
- **THEN** the command reads the pull request diff through `gh pr diff <number>`
- **AND** sends a compact structured-review prompt to the selected local provider
- **AND** posts one GitHub review containing inline comments for returned findings.

#### Scenario: Review without GitHub auth
- **WHEN** `gx pr-review --provider claude --pr <number> --post` runs without `GITHUB_TOKEN`, `GH_TOKEN`, or usable `gh auth`
- **THEN** the command does not require model API credentials
- **AND** writes a markdown review artifact containing the structured findings instead of posting.

### Requirement: VS Code Active Agents nested repo targeting
The VS Code Active Agents `Start agent` command SHALL allow users to target a nested Git repository discovered below the workspace root.

#### Scenario: Workspace has nested storefront and backend repos
- **WHEN** the workspace contains nested Git repositories such as `apps/storefront` and `apps/backend`
- **AND** the user runs `Start agent` from the Active Agents view
- **THEN** the extension prompts for the target Git repo
- **AND** the spawned terminal uses the selected nested repo as its cwd
- **AND** the launcher command creates a Guardex agent branch/worktree for that nested repo instead of changing the visible nested repo's `main` checkout in place.

#### Scenario: Workspace has one Git repo
- **WHEN** only one Git repo is available in the workspace
- **THEN** the extension keeps the existing direct start flow without an unnecessary picker.

### Requirement: PostToolUse edit tracker Python compatibility
The `PostToolUse` edit-tracker hook SHALL run successfully under the system `python3` used by Claude Code when that interpreter is Python 3.10 or newer.

#### Scenario: Claude edit tracker hook starts cleanly
- **WHEN** Claude Code invokes `.claude/hooks/post_edit_tracker.py` with a valid `PostToolUse` payload
- **THEN** the hook exits with status `0`
- **AND** no `ImportError` traceback is emitted for `datetime.UTC`.

### Requirement: Setup links Claude guidance to AGENTS when absent
`gx setup` and `gx doctor` SHALL create a root `CLAUDE.md` symlink to `AGENTS.md` when the target repository has no root `CLAUDE.md`.

#### Scenario: Fresh setup creates both guidance entrypoints
- **WHEN** `gx setup --target <repo>` runs in a repo with no root `AGENTS.md` or `CLAUDE.md`
- **THEN** `AGENTS.md` contains the Guardex managed guidance block
- **AND** `CLAUDE.md` is a symlink whose target is `AGENTS.md`.

#### Scenario: Existing Claude guidance is preserved
- **GIVEN** the target repo already has a root `CLAUDE.md`
- **WHEN** `gx setup --target <repo>` runs
- **THEN** Guardex SHALL leave the existing `CLAUDE.md` content and file type unchanged.

### Requirement: Fleet cockpit scan view
The system SHALL render cockpit sessions as a compact fleet board that is easy to scan by agent state.

#### Scenario: Active sessions are grouped by operator state
- **WHEN** the cockpit renderer receives sessions with working, thinking, blocked, done, and stale states
- **THEN** it SHALL include a summary count for each state
- **AND** it SHALL render non-empty state groups with clear headings.

#### Scenario: Session rows preserve follow-up evidence
- **WHEN** a session is rendered in the fleet board
- **THEN** its row SHALL include branch, progress, worktree, lock, changed-file, task, Colony metadata, PR, and heartbeat details when available
- **AND** existing cockpit text output consumers SHALL still receive a plain terminal string.

