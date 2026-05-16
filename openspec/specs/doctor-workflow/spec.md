# doctor-workflow Specification

## Purpose
TBD - created by archiving change agent-codex-surface-doctor-hidden-failures-2026-04-22-17-06. Update Purpose after archive.
## Requirements
### Requirement: compact doctor auto-finish output surfaces failures before truncating skips
The human-readable compact `gx doctor` auto-finish sweep SHALL keep failed branch results visible when the detail list is truncated.

#### Scenario: compact output promotes a failed row ahead of skipped rows
- **GIVEN** the auto-finish sweep contains more branch details than the compact visible limit
- **AND** at least one failed branch result appears after several skipped rows in raw branch iteration order
- **WHEN** `gx doctor` prints the compact auto-finish summary
- **THEN** a failed branch detail SHALL still appear in the visible compact rows
- **AND** hidden branch results SHALL be summarized with status counts so remaining hidden failures stay explicit

### Requirement: `gx doctor` keeps recursive progress visible
The human-readable `gx doctor` workflow SHALL keep progress visible while recursive child doctor runs execute, so large nested workspaces do not appear frozen.

#### Scenario: nested doctor targets stream visible progress
- **GIVEN** `gx doctor` is running recursively across multiple git repos
- **WHEN** a nested repo doctor run starts and then completes
- **THEN** the CLI SHALL print a target line for that repo before the child run
- **AND** it SHALL print a completion line with the same target plus elapsed time after that repo finishes

### Requirement: doctor sweep respects `--no-wait-for-merge`
The doctor auto-finish sweep SHALL honor the doctor wait mode when it delegates to `scripts/agent-branch-finish.sh`.

#### Scenario: no-wait mode is forwarded into ready-branch cleanup
- **GIVEN** a ready local `agent/*` branch exists during `gx doctor --no-wait-for-merge`
- **WHEN** doctor invokes the auto-finish sweep for that branch
- **THEN** it SHALL call the finish script with `--no-wait-for-merge`
- **AND** it SHALL not silently fall back to `--wait-for-merge`

### Requirement: doctor sweep output stays compact by default
The human-readable auto-finish sweep SHALL show concise actionable branch results by default and SHALL preserve the raw failure text behind an explicit verbose flag.

#### Scenario: default doctor output summarizes a long finish failure
- **GIVEN** an auto-finish failure emits a long rebase-conflict command trace
- **WHEN** `gx doctor` runs without `--verbose-auto-finish`
- **THEN** the default branch detail line SHALL summarize the actionable reason instead of dumping the full `git -C ... rebase --continue` command

#### Scenario: verbose doctor output keeps the raw finish failure text
- **GIVEN** the same auto-finish failure
- **WHEN** `gx doctor --verbose-auto-finish` runs
- **THEN** the printed branch detail SHALL include the original failure text

### Requirement: doctor sweep classifies manual conflict work as actionable skips
The human-readable `gx doctor` auto-finish sweep SHALL classify recoverable manual conflict states as skip/manual-action rows instead of hard failures.

#### Scenario: auto-finish rebase conflict becomes a skip/manual-action row
- **GIVEN** a ready local `agent/*` branch exists during `gx doctor`
- **AND** `scripts/agent-branch-finish.sh` stops because it needs a human to continue or abort a source-probe rebase
- **WHEN** doctor prints the auto-finish summary
- **THEN** the summary SHALL not count that branch as failed
- **AND** the branch detail SHALL be emitted as a skip/manual-action row with the rebase instructions preserved in verbose mode

#### Scenario: true auto-finish failures remain failures
- **GIVEN** a ready local `agent/*` branch exists during `gx doctor`
- **AND** `scripts/agent-branch-finish.sh` fails for a reason other than a recoverable manual conflict
- **WHEN** doctor prints the auto-finish summary
- **THEN** the summary SHALL still count that branch as failed
- **AND** the branch detail SHALL remain a failed row

### Requirement: bare `gx` can hand off directly into doctor repair
The default no-argument `gx` entrypoint SHALL be able to hand off directly into `gx doctor` when repo safety is degraded and auto-repair is enabled for the current session.

#### Scenario: degraded bare `gx` auto-runs doctor in auto-repair mode
- **GIVEN** bare `gx` runs against a repo whose safety service is degraded
- **AND** auto-repair is enabled for the current session
- **WHEN** the default status summary finishes rendering
- **THEN** the CLI SHALL print an explicit auto-repair handoff line
- **AND** it SHALL run the same doctor workflow a human would get from `gx doctor`
- **AND** the resulting exit code SHALL match that doctor run

#### Scenario: status-only degraded bare `gx` stays non-mutating when auto-repair is disabled
- **GIVEN** bare `gx` runs against a degraded repo
- **AND** auto-repair is disabled for the current session
- **WHEN** the default status summary renders
- **THEN** the CLI SHALL remain status-only and SHALL NOT run doctor automatically
- **AND** it SHALL tell the human to run `gx doctor` for repair

### Requirement: auto-doctor handoff stays visibly active
When bare `gx` auto-starts doctor in human-readable mode, the handoff SHALL stay visibly active instead of appearing frozen.

#### Scenario: auto-doctor startup shows transient progress before doctor output starts
- **GIVEN** bare `gx` is auto-starting `gx doctor` in a human shell
- **WHEN** the doctor subprocess has not emitted its first output yet
- **THEN** the CLI SHALL show a transient progress indicator for the doctor handoff
- **AND** that indicator SHALL clear once doctor output begins or the subprocess exits

### Requirement: `gx doctor` uses semantic status colors
When ANSI color output is enabled, the human-readable `gx doctor` workflow SHALL color success lines green, failure lines red, and skip or pending lines yellow.

#### Scenario: safe doctor lines render green
- **GIVEN** `gx doctor` runs in human-readable mode with ANSI color output enabled
- **WHEN** the repo scan reports `No safety issues detected.` and doctor reaches `Repo is fully safe.`
- **THEN** both success lines SHALL be emitted in green

#### Scenario: doctor auto-finish failures render red
- **GIVEN** `gx doctor` runs in human-readable mode with ANSI color output enabled
- **AND** the auto-finish sweep reports at least one failed branch result
- **WHEN** doctor prints the auto-finish summary and failed branch detail
- **THEN** the failure summary line SHALL be emitted in red
- **AND** the failed branch detail line SHALL be emitted in red

#### Scenario: doctor skip or pending lines render yellow
- **GIVEN** `gx doctor` runs in human-readable mode with ANSI color output enabled
- **WHEN** doctor prints a skipped or pending auto-finish line
- **THEN** that line SHALL be emitted in yellow

