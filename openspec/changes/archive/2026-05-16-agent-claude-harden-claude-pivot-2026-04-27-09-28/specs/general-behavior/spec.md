## ADDED Requirements

### Requirement: `gx pivot` provides a single-tool-call escape from a protected branch

The system SHALL expose a `gx pivot "<task>" "<agent>" [--tier T0|T1|T2|T3]`
subcommand that AI agents can call from a protected (`dev`/`main`/`master`) or
non-`agent/*` branch to obtain an isolated agent worktree.

#### Scenario: Pivot from a protected branch

- **WHEN** `gx pivot "<task>" "<agent>"` is invoked on a non-`agent/*` branch
- **THEN** the command SHALL forward to the existing `agent-branch-start.sh`
  flow (which migrates dirty primary-tree changes via auto-stash) and create a
  new `agent/<role>/<slug>` branch + worktree
- **AND** stdout SHALL include three machine-parseable trailer lines:
  `WORKTREE_PATH=<absolute-worktree-path>`, `BRANCH=<agent-branch-name>`, and
  `NEXT_STEP=cd "<absolute-worktree-path>"`
- **AND** the exit code SHALL be `0`.

#### Scenario: Pivot is a no-op on an existing agent branch

- **WHEN** `gx pivot` is invoked from inside an `agent/*` worktree
- **THEN** the command SHALL print `Already on agent branch '<name>'.` plus
  the same `WORKTREE_PATH=` / `BRANCH=` / `NEXT_STEP=cd "..."` trailer pointing
  at the current worktree
- **AND** the command SHALL NOT create a new branch or worktree
- **AND** the exit code SHALL be `0`.

### Requirement: `gx ship` defaults to the canonical "I am done" finish flags

The system SHALL expose a `gx ship` subcommand that aliases `gx finish` while
ensuring `--via-pr`, `--wait-for-merge`, and `--cleanup` are always present.

#### Scenario: Missing flags are injected

- **WHEN** `gx ship --branch agent/claude/foo` is invoked
- **THEN** `gx finish` SHALL receive `--branch agent/claude/foo --via-pr
  --wait-for-merge --cleanup`
- **AND** flags already supplied by the caller SHALL NOT be duplicated.

### Requirement: `skill_guard` allows safe sync ops on protected branches

The system SHALL allow the following commands to run from non-`agent/*`
branches without setting `ALLOW_BASH_ON_NON_AGENT_BRANCH=1`:

- `git pull`, `git pull --ff-only [...]`, `git pull --rebase [...]`
- `git stash list`, `git stash show`
- `git push [origin] agent/<name>` and `git push [origin] HEAD:agent/<name>`
  (only the `agent/*` ref namespace)
- `gh pr {list,view,checks,status,create,edit,comment,review,ready,reopen,merge}`,
  `gh issue {list,view,status,create,comment}`,
  `gh run {list,view,watch}`, `gh workflow {list,view,run}`
- Any subcommand of `gx`, `guardex`, `gitguardex`, or `multiagent-safety`
- `bash scripts/agent-branch-finish.sh ...`,
  `bash scripts/agent-pivot.sh ...`

#### Scenario: Pure sync command on protected branch is allowed

- **WHEN** the current branch is `main` and `git pull --ff-only origin main` is
  invoked through Claude Code's `Bash` tool
- **THEN** the `skill_guard` PreToolUse hook SHALL exit `0` without printing a
  `BLOCKED:` message.

#### Scenario: Destructive command on protected branch is still blocked

- **WHEN** the current branch is `main` and `git reset --hard HEAD` is invoked
  through Claude Code's `Bash` tool
- **THEN** the `skill_guard` PreToolUse hook SHALL exit `2` with a `BLOCKED:`
  message that points the agent at `gx pivot "<task>" "<agent-name>"`.

### Requirement: BLOCKED messages name the auto-pivot escape first

The system SHALL update both `ensure_protected_branch_edit_allowed` (Edit /
Write / patch tools) and `ensure_non_agent_shell_command_allowed` (Bash) to
mention `gx pivot "<task>" "<agent-name>"` as the recommended single-tool-call
recovery, and clarify that the override env (`ALLOW_BASH_ON_NON_AGENT_BRANCH`,
`ALLOW_CODE_EDIT_ON_PROTECTED_BRANCH`) must be exported in the harness env,
not as a command prefix inside a tool call.

#### Scenario: Block message instructs `gx pivot`

- **WHEN** Claude Code attempts an `Edit` on a protected branch
- **THEN** the `BLOCKED:` message SHALL contain the literal substring
  `gx pivot "<task>" "<agent-name>"` and the literal substring `export `
  prefixing the override env name.
