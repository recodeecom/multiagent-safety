# companion-tooling Specification

## Purpose
TBD - created by archiving change agent-codex-add-caveman-stack-and-claudecode-links-2026-04-21-03-02. Update Purpose after archive.
## Requirements
### Requirement: `gx status` reflects the current companion npm toolchain

The `gx status` and `gx setup` npm-global companion-tool path SHALL track the current machine-detectable companion CLI set: `oh-my-codex`, `oh-my-claude-sisyphus`, `@fission-ai/openspec`, `cavemem`, and `@imdeadpool/codex-account-switcher`.

#### Scenario: `cavemem` is installed globally

- **GIVEN** `npm ls -g --json` includes `cavemem`
- **WHEN** the user runs `gx status` or `gx status --json`
- **THEN** the reported services include `cavemem`
- **AND** its state is `active`

#### Scenario: setup installs missing companion npm tools

- **GIVEN** `oh-my-codex` is already present globally
- **AND** one or more of `oh-my-claude-sisyphus`, `@fission-ai/openspec`, `cavemem`, or `@imdeadpool/codex-account-switcher` are missing
- **WHEN** the user runs `gx setup` and approves the optional global install prompt
- **THEN** Guardex installs only the missing companion npm tools

### Requirement: README companion docs use current official tool names

The README companion-tools section SHALL use the current official repo/install names for the Claude-side orchestration project and SHALL document the Caveman ecosystem add-ons (`caveman`, `cavemem`, `cavekit`) with their official companion-tool guidance.

#### Scenario: reader checks the companion tools section

- **GIVEN** a reader opens the README companion-tools section
- **WHEN** they inspect the Claude and Caveman ecosystem entries
- **THEN** they see `oh-my-claudecode` as the repo/project name
- **AND** they see `oh-my-claude-sisyphus` as the npm runtime package name
- **AND** they see companion entries for `caveman`, `cavemem`, and `cavekit`

### Requirement: Claude companion status uses the upstream project name

Guardex SHALL present the Claude companion as `oh-my-claudecode` in human-facing status/setup surfaces while preserving the underlying npm package mapping to `oh-my-claude-sisyphus`.

#### Scenario: `gx status --json` reports the Claude companion

- **WHEN** the user runs `gx status --json`
- **THEN** the `services` array contains an entry named `oh-my-claudecode`
- **AND** that entry exposes `packageName` as `oh-my-claude-sisyphus`

### Requirement: Inactive Claude companion surfaces the dependency repo

When the Claude companion is inactive, Guardex SHALL tell the user that the dependency maps to the upstream `oh-my-claudecode` repository.

#### Scenario: `oh-my-claudecode` is inactive during status

- **GIVEN** `oh-my-claude-sisyphus` is absent from the detected global npm packages
- **WHEN** the user runs `gx status`
- **THEN** the output marks `oh-my-claudecode` as inactive
- **AND** the output prints the repository URL `https://github.com/Yeachan-Heo/oh-my-claudecode`

### Requirement: Declined companion installs leave an explicit dependency warning

If the user declines optional companion installation, Guardex SHALL not install the package and SHALL warn that the `oh-my-claudecode` dependency is still missing.

#### Scenario: user skips companion installation

- **GIVEN** `oh-my-claude-sisyphus` is missing
- **WHEN** the user declines companion installation (interactive `n`/`no` or `--no-global-install`)
- **THEN** Guardex does not run the global npm install for that package
- **AND** setup prints a warning that `oh-my-claudecode` remains a required dependency

### Requirement: Colony replaces cavemem as the global coordination companion

Guardex SHALL detect and prompt for the Colony CLI package `@imdeadpool/colony-cli` as the global multi-agent coordination companion instead of `cavemem`.

#### Scenario: `gx status --json` reports the Colony companion

- **WHEN** the user runs `gx status --json`
- **THEN** the `services` array contains an entry named `colony`
- **AND** that entry exposes `packageName` as `@imdeadpool/colony-cli`
- **AND** the services array does not require a `cavemem` entry

#### Scenario: setup installs missing global companions

- **GIVEN** `@imdeadpool/colony-cli` is absent from detected global npm packages
- **WHEN** the user approves companion installation
- **THEN** Guardex includes `@imdeadpool/colony-cli` in the global npm install command
- **AND** Guardex does not install `cavemem` as part of the global companion set

### Requirement: README shows Colony runtime registration

Guardex documentation SHALL show users how to install Colony and register one or more agent runtimes.

#### Scenario: user reads companion tooling docs

- **WHEN** the README companion tools table is inspected
- **THEN** the Colony row includes `npm i -g @imdeadpool/colony-cli`
- **AND** it lists `colony install --ide codex`, `colony install --ide claude-code`, `colony install --ide cursor`, `colony install --ide gemini-cli`, and `colony install --ide opencode`
- **AND** it tells users to verify with `colony status`

