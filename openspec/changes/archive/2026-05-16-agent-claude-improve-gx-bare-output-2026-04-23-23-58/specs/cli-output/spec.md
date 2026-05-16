## ADDED Requirements

### Requirement: bare `gx` renders a compact status banner in interactive TTYs

Guardex SHALL render the default `gx` (no subcommand) status output as a compact single-screen banner whenever stdout is an interactive TTY and every global service is active. The banner SHALL:

- Keep the `[gitguardex] CLI: …` version/runtime line unchanged.
- Collapse the `Global services:` block to a single `[gitguardex] Global services: N/N ● active` line.
- Preserve the existing `Repo safety service:`, `Repo:`, and `Branch:` lines verbatim.
- Emit a context-aware `[gitguardex] Next: …` hint (see requirements below).
- End with a single `[gitguardex] Try '<invoked> help' for commands, or '<invoked> status --verbose' for full service details.` pointer.

#### Scenario: interactive TTY, all services active, non-agent branch

- **GIVEN** stdout is a TTY
- **AND** every entry in the toolchain services list has status `active`
- **AND** the current branch does NOT start with `agent/`
- **WHEN** the user runs bare `gx`
- **THEN** the output SHALL be 6 to 9 lines total (CLI + collapsed services + repo safety + repo + branch + optional worktree warning + Next + Try-help pointer)
- **AND** the output SHALL NOT contain the `USAGE` / `COMMANDS` / `AGENT BOT` / `REPO TOGGLE` help tree.

### Requirement: `--verbose` / `GUARDEX_VERBOSE_STATUS` force the expanded banner

Guardex SHALL re-expand the `Global services:` list and render the full help tree whenever the user passes `--verbose` to `gx` / `gx status` or sets `GUARDEX_VERBOSE_STATUS=1` in the environment, regardless of TTY detection or compact overrides.

#### Scenario: user asks for verbose output in a TTY

- **GIVEN** stdout is a TTY and every service is active (default compact path)
- **WHEN** the user runs `gx status --verbose`
- **THEN** each service SHALL be listed on its own `  - ● <name>: <status>` line
- **AND** the help tree SHALL appear with the `<invoked> help:` title and grouped `USAGE` / `QUICKSTART` / `COMMANDS` / `AGENT BOT` / `REPO TOGGLE` sections.

### Requirement: `GUARDEX_COMPACT_STATUS` forces the compact banner in non-TTY output

Guardex SHALL render the compact banner whenever `GUARDEX_COMPACT_STATUS` is set to a truthy value (`1`, `true`, `yes`, `on`), even if stdout is not a TTY and even if some services report degraded or inactive state. The override SHALL lose to `--verbose` / `GUARDEX_VERBOSE_STATUS`.

#### Scenario: compact override in a pipe

- **GIVEN** stdout is not a TTY (output is piped to `head`, captured by a test harness, etc.)
- **AND** `GUARDEX_COMPACT_STATUS=1` is set
- **WHEN** the user runs `gx`
- **THEN** the output SHALL use the compact banner layout
- **AND** the expanded services list SHALL NOT be emitted.

### Requirement: banner surfaces a context-aware next step

Guardex SHALL derive the `[gitguardex] Next: …` hint on every bare `gx` / `gx status` run from cheap local signals — current branch name, agent-worktree count, guardex toggle, and scan error/warning counts. No subprocess SHALL be spawned to compute the hint.

#### Scenario: user is currently on an agent branch

- **GIVEN** the resolved branch name starts with `agent/`
- **WHEN** the banner is rendered
- **THEN** the `Next:` hint SHALL read exactly `<invoked> branch finish --branch "<agent-branch>" --via-pr --wait-for-merge --cleanup`.

#### Scenario: user is on the base branch with active agent worktrees

- **GIVEN** the current branch is a base/protected branch (not `agent/*`)
- **AND** at least one directory exists under `.omc/agent-worktrees/` or `.omx/agent-worktrees/`
- **WHEN** the banner is rendered
- **THEN** the banner SHALL emit `[gitguardex] ⚠ N active agent worktree(s) → <invoked> finish --all` directly after the `Branch:` line (where N is the total count across both directories)
- **AND** the `Next:` hint SHALL read `<invoked> finish --all   # N active agent worktree(s)`.

#### Scenario: stdout is not a git repo

- **GIVEN** `inGitRepo` is false
- **WHEN** the banner is rendered
- **THEN** the `Next:` hint SHALL read `<invoked> setup --target <path-to-git-repo>   # initialize guardrails in a repo`.

### Requirement: banner uses the invoked CLI name for branding

Guardex SHALL render the banner title, the `Next:` command template, and the `Try '<invoked> …'` pointer using the basename of `process.argv[1]` (normalized to `gx` / `gitguardex` / `guardex`, with an unknown basename falling back to `gx`). The internal `<TOOL_NAME>-tools logs:` label SHALL be removed.

#### Scenario: user invokes via `gitguardex` alias

- **GIVEN** the user runs `gitguardex` (not `gx`)
- **AND** the banner is rendered in expanded mode
- **THEN** the expanded banner title SHALL read `gitguardex help:` (not `gitguardex-tools logs:` or `gx help:`)
- **AND** the footer SHALL read `Try 'gitguardex doctor' for one-step repair + verification.`.

#### Scenario: user invokes via `gx`

- **GIVEN** the user runs `gx`
- **AND** the banner is rendered in expanded mode
- **THEN** the expanded banner title SHALL read `gx help:`
- **AND** the footer SHALL read `Try 'gx doctor' for one-step repair + verification.`.
