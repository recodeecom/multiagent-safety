## ADDED Requirements

### Requirement: agent-branch-finish cleans up source-probe worktrees on every exit path
`agent-branch-finish.sh` SHALL remove any `__source-probe-*` worktree it created, regardless of whether the script exits via success, sync-guard rebase failure, preflight merge conflict, or any other `exit` path after probe creation.

#### Scenario: Sync-guard rebase conflict leaves no leaked probe
- **WHEN** `agent-branch-finish.sh` is invoked on an agent branch that has no live worktree
- **AND** the sync-guard rebase against `origin/<base>` fails with conflicts
- **THEN** the script exits non-zero
- **AND** the throwaway `__source-probe-*` worktree directory is removed
- **AND** `git worktree list` shows no entry for the probe path.

#### Scenario: Preflight merge conflict leaves no leaked probe
- **WHEN** `agent-branch-finish.sh` runs and the preflight `merge --no-commit --no-ff origin/<base>` fails
- **THEN** the script exits non-zero
- **AND** the probe worktree (if created) is removed before exit.

#### Scenario: Happy path still removes the probe
- **WHEN** `agent-branch-finish.sh` completes successfully
- **THEN** the probe worktree and the `__integrate-*` worktree are both removed.
