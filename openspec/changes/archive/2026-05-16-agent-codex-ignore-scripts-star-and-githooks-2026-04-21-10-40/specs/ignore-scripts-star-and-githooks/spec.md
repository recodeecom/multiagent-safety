## ADDED Requirements

### Requirement: Managed `.gitignore` block ignores Guardex bootstrap directories with wildcard entries

The marker-delimited `.gitignore` block written by `gx setup` and refreshed by `gx doctor` SHALL ignore the Guardex-managed bootstrap directories using stable directory-wide entries instead of enumerating individual files.

#### Scenario: Fresh setup writes wildcard Guardex ignore entries
- **GIVEN** a repo without an existing managed `.gitignore` block
- **WHEN** the user runs `gx setup --target <repo>`
- **THEN** the resulting managed block contains `scripts/*`
- **AND** the resulting managed block contains `.githooks`

#### Scenario: Repair refresh rewrites older per-file ignore entries
- **GIVEN** a repo whose managed `.gitignore` block was written by an earlier Guardex version with per-file `scripts/...` and `.githooks/...` entries
- **WHEN** the user runs `gx doctor --target <repo>` or `gx setup --target <repo>`
- **THEN** the managed block is rewritten to contain `scripts/*` and `.githooks`
- **AND** the managed block no longer depends on individual script or hook path entries for Guardex-managed files

### Requirement: Doctor repairs restore `AGENTS.md` alongside wildcard ignore entries

When `gx doctor` repairs Guardex drift, the repair flow SHALL restore `AGENTS.md` and the managed wildcard `.gitignore` entries together, including protected-branch sandbox repairs and nested-repo repairs.

#### Scenario: Protected-main doctor restores AGENTS and wildcard ignore entries
- **GIVEN** a protected-`main` repo where `AGENTS.md` has drifted away
- **WHEN** the user runs `gx doctor --target <repo>`
- **THEN** the repo regains `AGENTS.md`
- **AND** its managed `.gitignore` block contains `scripts/*` and `.githooks`
- **AND** the protected-branch finish flow keeps `main` as the base branch instead of falling back to `dev`

#### Scenario: Recursive doctor restores nested repo AGENTS and wildcard ignore entries
- **GIVEN** a parent repo with a nested standalone frontend repo on protected `main`
- **AND** the nested repo is missing `AGENTS.md`
- **AND** the nested repo's managed `.gitignore` block is missing `scripts/*` and `.githooks`
- **WHEN** the user runs `gx doctor --target <parent-repo>`
- **THEN** the nested repo regains `AGENTS.md`
- **AND** the nested repo's managed `.gitignore` block contains `scripts/*` and `.githooks`
