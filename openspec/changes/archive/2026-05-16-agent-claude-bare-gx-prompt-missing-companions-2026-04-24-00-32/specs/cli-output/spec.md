## ADDED Requirements

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
