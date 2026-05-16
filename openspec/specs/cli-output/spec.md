# cli-output Specification

## Purpose
TBD - created by archiving change agent-claude-bare-gx-prompt-missing-companions-2026-04-24-00-32. Update Purpose after archive.
## Requirements
### Requirement: bare `gx` offers an inline install prompt for missing companion tools

Guardex SHALL detect missing global companion packages (`GLOBAL_TOOLCHAIN_PACKAGES`) and missing optional local companion tools (`OPTIONAL_LOCAL_COMPANION_TOOLS`) on every bare `gx` / `gx status` run and, when appropriate, offer an inline `[y/n]` prompt to install them — without requiring the user to invoke `gx setup` first.

#### Scenario: interactive TTY with missing companions

- **GIVEN** `gx` is invoked with no subcommand
- **AND** stdout and stdin are both TTYs
- **AND** `GUARDEX_SKIP_COMPANION_PROMPT` is not set to a truthy value
- **AND** `options.json` is false
- **AND** at least one global companion package is not installed, or at least one optional local companion tool reports `inactive`
- **WHEN** the banner pre-render step runs
- **THEN** Guardex SHALL print `[gitguardex] Missing companion tools: <names>.` where `<names>` is the comma-separated list of missing companions in detection order
- **AND** Guardex SHALL prompt `Install missing companion tools now? (npm i -g <pkgs> && <local-install-cmd>) [y/n]`
- **AND** on `y`, Guardex SHALL run `performCompanionInstall(missingPackages, missingLocalTools)` and report `✅ Companion tools installed (<names>)` on success or `⚠️ Companion install failed: <reason>` on failure
- **AND** on `n`, Guardex SHALL print a one-line opt-out hint referencing `GUARDEX_SKIP_COMPANION_PROMPT=1` and `<invoked> setup --install-only`
- **AND** after a successful install, the banner SHALL refresh its service snapshot so the rendered `Global services:` line reflects the newly installed tools.

### Requirement: non-interactive runs skip the companion-install prompt

Guardex SHALL NOT prompt for companion installs when stdout or stdin is not a TTY, unless the caller explicitly opts in via `GUARDEX_AUTO_COMPANION_APPROVAL=yes` / `no`. The `--json` path SHALL never prompt.

#### Scenario: piped output

- **GIVEN** stdout is not a TTY (output is piped, tests, CI)
- **AND** `GUARDEX_AUTO_COMPANION_APPROVAL` is unset
- **WHEN** `gx` runs
- **THEN** Guardex SHALL skip the inline companion-install prompt entirely
- **AND** the banner output SHALL match the pre-prompt contract byte-for-byte (no extra lines).

#### Scenario: auto-approval in CI

- **GIVEN** stdout is not a TTY
- **AND** `GUARDEX_AUTO_COMPANION_APPROVAL=yes` is set
- **AND** at least one companion is missing
- **WHEN** `gx` runs
- **THEN** Guardex SHALL invoke `performCompanionInstall(...)` without asking
- **AND** report the install result using the same `✅ Companion tools installed …` / `⚠️ Companion install failed …` lines as the interactive path.

### Requirement: `GUARDEX_SKIP_COMPANION_PROMPT` opts a user out permanently

Guardex SHALL treat a truthy `GUARDEX_SKIP_COMPANION_PROMPT` (`1` / `true` / `yes` / `on`) as a full bypass of the inline companion prompt — even in an interactive TTY with missing companions.

#### Scenario: user sets the opt-out env var

- **GIVEN** `GUARDEX_SKIP_COMPANION_PROMPT=1` is set in the environment
- **AND** stdout + stdin are TTYs
- **AND** at least one companion is missing
- **WHEN** `gx` runs
- **THEN** Guardex SHALL NOT print `Missing companion tools:` or the `[y/n]` prompt
- **AND** the banner SHALL render the existing inactive-companion warning block verbatim (unchanged behavior from the prior release).

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

