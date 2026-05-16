# Doctor spec delta — auto-prune stale agent worktrees

## ADDED Requirements

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
