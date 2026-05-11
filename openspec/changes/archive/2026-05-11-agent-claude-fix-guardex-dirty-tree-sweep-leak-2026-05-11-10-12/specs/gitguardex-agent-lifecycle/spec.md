# Spec Delta: gitguardex-agent-lifecycle

## ADDED Requirements

### Requirement: Auto-transfer stash MUST exclude state-file globs by default

When `gx branch start` is invoked on a protected branch with a dirty working tree, the auto-transfer stash MUST omit paths matching the canonical state-file glob list (`.omc/**`, `.omx/state/**`, `.dev-ports.json`, `apps/logs/**`, `.agents/settings.local.json`, `.codex/state/**`, `.claude/state/**`) so those paths remain on the protected branch instead of being applied onto the newly created agent worktree.

#### Scenario: Protected branch has tracked code changes and untracked state files

- **GIVEN** the user is on the protected base branch
- **AND** the working tree has modifications to a tracked code file plus an untracked file under `.omc/`
- **WHEN** `gx branch start "<task>" "<agent>"` runs
- **THEN** the new agent worktree contains the tracked code change as a transferred stash
- **AND** the untracked `.omc/...` file remains on the protected branch and is not present in the agent worktree

#### Scenario: All dirty paths match the exclude list

- **GIVEN** the user is on the protected base branch with only state-file dirt (e.g. `.omc/project-memory.json` modified)
- **WHEN** `gx branch start ...` runs
- **THEN** no stash entry is created
- **AND** the script logs that the dirt was left in place because it all matched the exclude list
- **AND** the new agent worktree starts clean

### Requirement: `gx branch start` MUST support disabling the auto-transfer

`gx branch start` MUST accept a `--no-transfer` flag (and the `GUARDEX_AUTO_TRANSFER=false` env var) that prevents the auto-transfer stash from running at all, regardless of dirty state.

#### Scenario: User opts out with --no-transfer

- **GIVEN** the user is on the protected base branch with arbitrary dirty state
- **WHEN** `gx branch start --no-transfer "<task>" "<agent>"` runs
- **THEN** no `git stash push` is executed
- **AND** the user receives a log line explaining the dirt was left in place
- **AND** the new agent worktree starts from a clean base-branch checkout

### Requirement: `gx branch finish --auto-resolve=safe` MUST auto-resolve only allowlisted conflict paths

When `--auto-resolve=safe` is set, the preflight base-into-source merge in `gx branch finish` MUST resolve any conflict whose path matches the safe allowlist (`.omc/**`, `.omx/state/**`, etc.) by checking out the base version and staging it, then commit the merge. Any conflict path outside the allowlist MUST cause the script to abort the merge and exit non-zero with the unresolved list reported.

#### Scenario: All conflicts are state-file paths

- **GIVEN** the agent branch and `origin/<base>` have divergent edits limited to paths under the safe allowlist
- **WHEN** `gx branch finish --branch <branch> --auto-resolve=safe ...` runs
- **THEN** the preflight merge proceeds
- **AND** each conflicting allowlisted path is resolved to the base version
- **AND** the resolved paths are claimed via `gx locks claim` before commit so the pre-commit lock guard accepts the merge
- **AND** a single merge commit lands on the agent branch
- **AND** finish continues into the normal push/PR flow

#### Scenario: At least one conflict is outside the allowlist

- **GIVEN** the agent branch and `origin/<base>` have a conflict on both an allowlisted state file and a source-code file
- **WHEN** `gx branch finish --branch <branch> --auto-resolve=safe ...` runs
- **THEN** the merge is aborted
- **AND** the script exits non-zero
- **AND** the unresolved path is listed in the abort message
- **AND** no resolution commit is created

#### Scenario: `--auto-resolve` is not set

- **GIVEN** the agent branch and `origin/<base>` have any preflight conflict
- **WHEN** `gx branch finish --branch <branch> ...` runs without `--auto-resolve`
- **THEN** the script aborts with the historical preflight-conflict error
- **AND** the error message suggests rerunning with `--auto-resolve=safe`

### Requirement: `--auto-resolve` MUST validate its mode argument

`gx branch finish` MUST accept exactly two `--auto-resolve` values: `none` and `safe`. Any other value MUST cause the script to exit non-zero before performing any merge or push.

#### Scenario: Unknown mode is rejected early

- **GIVEN** the user invokes `gx branch finish --auto-resolve=ours ...`
- **THEN** the script exits non-zero with `Invalid --auto-resolve value: ours (expected none|safe)`
- **AND** no merge, push, or PR action is taken
