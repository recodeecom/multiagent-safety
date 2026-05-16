## MODIFIED Requirements

### Requirement: Module seams mirror operational responsibility
The CLI SHALL separate major operational seams into dedicated modules under `src/` instead of keeping duplicated helper ownership in `src/cli/main.js`.

#### Scenario: Extracted helper ownership stays single-source
- **WHEN** maintainers inspect `src/cli/main.js`
- **THEN** parser helpers are imported from `src/cli/args.js`
- **AND** git/worktree helpers are imported from `src/git/index.js`
- **AND** command typo/deprecation helpers are imported from `src/cli/dispatch.js`
- **AND** `src/cli/main.js` does not redefine those helpers locally.

### Requirement: Refactor preserves targeted CLI behavior
The modularization SHALL preserve the current command surface for targeted verified flows while deleting the local duplicate helpers.

#### Scenario: Extracted helper seams remain wired through representative commands
- **WHEN** the focused CLI regression suites are run after the helper cleanup
- **THEN** representative command routes still execute through `src/cli/main.js`
- **AND** syntax/require-time failures do not occur from duplicate helper definitions.
