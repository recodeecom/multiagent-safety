## ADDED Requirements

### Requirement: `gx agents start` can claim files during lane startup

`gx agents start <task> --agent <agent> --claim <path>` SHALL create the agent branch/worktree and then claim each requested file for the created branch using the existing lock system.

#### Scenario: no startup claims

- **WHEN** a user runs `gx agents start "fix auth" --agent codex`
- **THEN** Guardex creates the agent branch/worktree
- **AND** Guardex does not create file lock entries.

#### Scenario: repeated startup claims

- **WHEN** a user runs `gx agents start "fix auth" --agent codex --claim src/auth.js --claim test/auth.test.js`
- **THEN** Guardex claims both files for the created branch after branch/worktree creation.

#### Scenario: claim failure

- **WHEN** branch/worktree creation succeeds but startup claim fails
- **THEN** Guardex SHALL exit nonzero
- **AND** Guardex SHALL mark the session state as `claim-failed`
- **AND** Guardex SHALL print recovery instructions with the worktree path and `gx locks claim --branch <branch> ...` command.
