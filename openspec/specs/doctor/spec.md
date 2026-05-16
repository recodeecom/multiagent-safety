# doctor Specification

## Purpose
TBD - created by archiving change agent-claude-auto-prune-stale-agent-worktrees-on-setu-2026-04-24-16-38. Update Purpose after archive.
## Requirements
### Requirement: gx setup and gx doctor MUST prune stale agent worktrees

`gx setup` and `gx doctor` SHALL, after completing the existing auto-finish sweep for ready agent branches, invoke the worktree-prune pipeline for each target repo so that merged-and-stale agent worktrees under `.omc/agent-worktrees/` and `.omx/agent-worktrees/` are removed without requiring a separate manual `gx cleanup` invocation.

The prune invocation SHALL:

- Pass `--delete-branches --delete-remote-branches --include-pr-merged` so that PR-squash-merged branches are caught (upstream merge commit not present on local `main`).
- Pass `--idle-minutes 60` (or the caller-provided `idleMinutes` override) so that worktrees touched within the idle window are preserved — protects an active agent from being pruned mid-run.
- Propagate the parent command's `--dry-run` flag so dry-run setup/doctor does not mutate state.
- Pass `--base <currentBaseBranch>` when the current local base branch is a non-agent, non-HEAD branch; omit the flag otherwise so the prune script infers the base.

The prune invocation SHALL be skipped when:

- The repo has Guardex disabled (`scanResult.guardexEnabled === false`).
- The env var `GUARDEX_SKIP_AUTO_WORKTREE_PRUNE=1` is set.
- The env var `GUARDEX_DOCTOR_SANDBOX=1` is set (nested sandbox pass, avoids recursion).

#### Scenario: doctor removes a stranded detached-HEAD worktree

- **GIVEN** a repo with a worktree at `.omc/agent-worktrees/<slug>/` whose branch has already been deleted (detached HEAD after successful merge)
- **WHEN** the operator runs `gx doctor`
- **THEN** the doctor output contains a `Stale agent-worktree prune` summary line
- **AND** the worktree directory no longer exists on disk
- **AND** the exit code is unchanged by the prune (still reflects scan result)

#### Scenario: setup honors the opt-out env var

- **GIVEN** a repo with a stranded agent worktree
- **WHEN** the operator runs `gx setup` with `GUARDEX_SKIP_AUTO_WORKTREE_PRUNE=1`
- **THEN** the worktree directory remains on disk
- **AND** the output mentions that the prune was skipped via opt-out

#### Scenario: dry-run does not prune

- **GIVEN** a repo with a stranded agent worktree
- **WHEN** the operator runs `gx doctor --dry-run`
- **THEN** the worktree directory remains on disk
- **AND** the prune summary reports `status=dry-run`

#### Scenario: JSON doctor output includes the prune payload

- **GIVEN** a repo where doctor runs with `--json`
- **WHEN** the JSON is emitted
- **THEN** the top-level object contains a `worktreePrune` field alongside the existing `autoFinish` field

### Requirement: doctor auto-finish sweep falls back to local direct merge

Guardex SHALL auto-finish ready agent branches during `gx doctor` even when the host repo lacks a GitHub-flavored `origin` remote or the `gh` CLI.

#### Scenario: repo without origin remote

- **GIVEN** a repo where `gx doctor` runs on a non-agent base branch (e.g. `main`)
- **AND** the repo has no `origin` remote configured
- **AND** at least one clean `agent/*` branch is ahead of the base
- **WHEN** `autoFinishReadyAgentBranches` runs
- **THEN** Guardex SHALL invoke `agent-branch-finish` with `--direct-only --no-push --cleanup`
- **AND** the agent branch SHALL be merged into the base branch locally
- **AND** the agent branch and its worktree SHALL be pruned after the merge completes
- **AND** the sweep summary SHALL report `completed=1` for that branch.

#### Scenario: non-GitHub origin remote or missing gh CLI

- **GIVEN** `gx doctor` runs on a non-agent base branch
- **AND** the repo has an `origin` remote that is not GitHub-flavored, or the `gh` CLI is not installed
- **AND** at least one clean `agent/*` branch is ahead of the base
- **WHEN** `autoFinishReadyAgentBranches` runs
- **THEN** Guardex SHALL invoke `agent-branch-finish` with `--direct-only --cleanup` so the merge is pushed to `origin` without attempting a PR.

### Requirement: doctor auto-finish commits dirty agent worktrees before merging

Guardex SHALL auto-commit pending worktree changes on an agent branch before evaluating the merge-or-skip decision in the doctor auto-finish sweep.

#### Scenario: uncommitted payload in agent worktree

- **GIVEN** `gx doctor` runs with an agent worktree that has uncommitted tracked/untracked changes
- **AND** the agent branch is otherwise clean (no merge in progress, no unresolved conflicts)
- **WHEN** `autoFinishReadyAgentBranches` reaches that branch
- **THEN** Guardex SHALL claim locks for the changed files, stage them, and commit them under the agent branch before attempting the merge
- **AND** the subsequent merge + cleanup SHALL run against the freshly committed state
- **AND** the auto-commit failure (if any) SHALL be reported as `[fail] ${branch}: auto-commit failed (...)` without aborting the rest of the sweep.

### Requirement: direct-only finish reuses existing base worktree when push is disabled

Guardex SHALL merge an agent branch directly into an already-checked-out base worktree when `agent-branch-finish` runs in direct mode with push disabled, instead of attempting to add a second worktree for the same base branch.

#### Scenario: base branch is the primary checkout

- **GIVEN** `scripts/agent-branch-finish.sh` is invoked with `--direct-only --no-push`
- **AND** the target base branch is already checked out in the primary worktree
- **AND** that worktree is clean
- **WHEN** the finish script reaches the integration-helper step
- **THEN** it SHALL run `git merge --no-ff --no-edit <agent-branch>` inside the existing base worktree
- **AND** it SHALL not call `git worktree add` for the same base branch
- **AND** a merge conflict SHALL abort cleanly without leaving a dangling integration worktree.

