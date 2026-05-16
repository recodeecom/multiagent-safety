## ADDED Requirements

### Requirement: `gx status` reports `oh-my-claude` alongside other global toolchain services

The `gx status` command SHALL include the npm package `oh-my-claude` in its global-toolchain service check, detecting installation via the same `npm ls -g` path used for `oh-my-codex`, `@fission-ai/openspec`, and `@imdeadpool/codex-account-switcher`.

#### Scenario: `oh-my-claude` is installed globally
- **GIVEN** `oh-my-claude` is present in `npm ls -g --json` dependencies output
- **WHEN** the user runs `gx` (no args) or `gx status`
- **THEN** the output includes a service line of the form `- ● oh-my-claude: active` (or the same marker used for other detected services).

#### Scenario: `oh-my-claude` is not installed globally
- **GIVEN** `oh-my-claude` is absent from `npm ls -g --json`
- **WHEN** the user runs `gx` or `gx status`
- **THEN** the output reports `oh-my-claude` as inactive (same inactive-state marker used for other missing services) — never silently omits it.

#### Scenario: `gx status --json` surfaces `oh-my-claude` in the `services` array
- **WHEN** the user runs `gx status --json`
- **THEN** the parsed JSON output's `services` array contains an entry whose package name or identifier matches `oh-my-claude`.

### Requirement: `gx setup` writes `.omc/` into the managed `.gitignore` block

The marker-delimited managed `.gitignore` block produced by `gx setup` / `gx doctor --repair` SHALL contain a `.omc/` entry alongside the existing `.omx/` entry, so future Claude-specific runtime state (worktrees, notepad, etc.) is ignored by default.

#### Scenario: Fresh repo setup produces the managed block with both roots
- **GIVEN** a repo without an existing managed block in `.gitignore`
- **WHEN** the user runs `gx setup --target <repo>`
- **THEN** the resulting `.gitignore` contains a marker-delimited managed block that includes both `.omx/` and `.omc/` as ignored paths.

#### Scenario: Repo with existing managed block picks up `.omc/` on repair
- **GIVEN** a repo whose managed `.gitignore` block was written by an earlier guardex version and lacks `.omc/`
- **WHEN** the user runs `gx setup --repair` or `gx doctor --repair`
- **THEN** the managed block is rewritten to include `.omc/` in addition to the previously-present entries.

#### Scenario: Assertions in `test/install.test.js` pin both entries
- **WHEN** the setup-produces-managed-gitignore test executes
- **THEN** it asserts the presence of both `.omx/` and `.omc/` patterns in the written `.gitignore`.
