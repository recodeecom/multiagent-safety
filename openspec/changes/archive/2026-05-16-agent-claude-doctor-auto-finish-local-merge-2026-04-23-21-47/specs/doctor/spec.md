## ADDED Requirements

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
