## ADDED Requirements

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
