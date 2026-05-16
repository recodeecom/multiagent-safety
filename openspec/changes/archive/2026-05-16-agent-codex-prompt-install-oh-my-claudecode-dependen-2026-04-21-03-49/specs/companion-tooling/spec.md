## ADDED Requirements

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
