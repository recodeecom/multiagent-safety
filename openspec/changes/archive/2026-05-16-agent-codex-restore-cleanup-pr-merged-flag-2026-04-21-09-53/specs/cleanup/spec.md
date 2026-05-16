## ADDED Requirements

### Requirement: explicit PR-merged cleanup flag
The cleanup workflow SHALL accept an explicit `--include-pr-merged` flag when invoking the prune script directly or through the `gx cleanup` CLI.

#### Scenario: cleanup forwards the explicit PR-merged flag
- **WHEN** maintainers run `gx cleanup --include-pr-merged`
- **THEN** the cleanup CLI forwards that flag to `scripts/agent-worktree-prune.sh`
- **AND** the prune script accepts the flag instead of exiting with an unknown-argument error.

### Requirement: squash-merged PR branches can be pruned
The prune script SHALL treat merged pull requests as an eligible cleanup signal for agent branches that are not merge-base ancestors of the base branch.

#### Scenario: squash-merged branch cleanup
- **WHEN** an `agent/*` branch has a merged pull request recorded for the current base branch
- **AND** the caller enables `--include-pr-merged`
- **THEN** cleanup removes the clean worktree for that branch
- **AND** cleanup deletes the local branch even if the merge was squash-only.
