## ADDED Requirements

### Requirement: GX Prompt Surfaces SHOULD Prefer RTK For Noisy Agent Commands

`gx prompt` managed guidance SHALL tell agents to prefer RTK wrappers for noisy
file discovery, git/GitHub inspection, test/build output, logs, and savings
analytics when `rtk` is available.

#### Scenario: default prompt includes RTK command examples

- **WHEN** a user runs `gx prompt`
- **THEN** the checklist includes RTK examples for file, git/GitHub, test/build,
  passthrough, and savings commands

#### Scenario: managed snippet includes RTK command discipline

- **WHEN** a user runs `gx prompt --snippet`
- **THEN** the managed AGENTS snippet includes RTK command-compression rules

### Requirement: GX Internal Parsers MUST Keep Machine Output Raw

Guardex SHALL NOT require internal machine-readable commands to be routed through
RTK when code parses stdout.

#### Scenario: parsed command output stays unfiltered

- **WHEN** Guardex code needs exact stdout from commands such as `git status --porcelain`,
  JSON output, NUL-delimited output, or other parsed command contracts
- **THEN** the guidance tells agents not to wrap those commands with RTK
