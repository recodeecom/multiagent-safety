# workflow-guardrails Specification

## Purpose
TBD - created by archiving change agent-codex-tolerate-already-deleted-local-branch-in-2026-04-22-20-43. Update Purpose after archive.
## Requirements
### Requirement: finish cleanup tolerates an already-missing local source branch after merge
The `gx branch finish` cleanup flow SHALL treat the local source-branch delete step as successful when the branch ref is already absent by the time post-merge cleanup runs.

#### Scenario: GitHub merge reports a local-branch delete problem but the branch is already gone during Guardex cleanup
- **GIVEN** `scripts/agent-branch-finish.sh` merges an `agent/*` branch through the PR flow
- **AND** the GitHub CLI reports a local branch delete problem during `gh pr merge --delete-branch`
- **AND** the local `refs/heads/<agent-branch>` ref is already missing by the time Guardex reaches its own cleanup branch-delete step
- **WHEN** Guardex continues cleanup
- **THEN** the finish command SHALL keep going without failing
- **AND** it SHALL emit an informational warning that the local branch was already deleted
- **AND** it SHALL still continue remote-branch cleanup and worktree pruning

#### Scenario: real local branch delete failures still fail finish cleanup
- **GIVEN** `scripts/agent-branch-finish.sh` reaches the local source-branch delete step
- **AND** the local `refs/heads/<agent-branch>` ref still exists
- **AND** `git branch -d <agent-branch>` fails for a reason other than the branch already being absent
- **WHEN** Guardex handles cleanup
- **THEN** the finish command SHALL still fail
- **AND** it SHALL preserve the underlying git error output

### Requirement: finish flow chooses a real base branch
Guardex SHALL finish agent branches against an available base branch even when no explicit base metadata is stored on the source branch.

#### Scenario: main-only repo without stored base metadata
- **GIVEN** an agent branch is being finished
- **AND** the branch does not have `branch.<name>.guardexBase` metadata
- **AND** the repo exposes `main` but not `dev`
- **WHEN** `scripts/agent-branch-finish.sh` resolves the base branch
- **THEN** it SHALL select `main`
- **AND** it SHALL not fall through to a non-existent `dev` base.

### Requirement: explicit agent roles stay visible in sandbox names
Guardex SHALL preserve explicit agent role tokens in branch/worktree naming while keeping legacy compatibility aliases for the common `codex`, `claude`, and `bot` flows.

#### Scenario: explicit planner role requested
- **GIVEN** `scripts/agent-branch-start.sh` is invoked with an explicit role such as `planner`
- **WHEN** the branch name is normalized
- **THEN** the emitted branch/worktree name SHALL keep the explicit sanitized role token
- **AND** legacy `bot` inputs SHALL still collapse to `codex`.

### Requirement: codex-agent auto-finish requires mergeable remote context
Guardex SHALL skip the PR auto-finish path when the current repo does not expose a mergeable GitHub-backed remote context.

#### Scenario: local or file-backed origin remote
- **GIVEN** `scripts/codex-agent.sh` finishes a successful task run
- **AND** the repo `origin` resolves to a local path or `file://` URL, or `gh` auth is not usable
- **WHEN** auto-finish evaluation runs
- **THEN** Guardex SHALL skip the PR merge/wait flow
- **AND** it SHALL keep the sandbox branch/worktree available for manual follow-up instead of waiting for merge.

