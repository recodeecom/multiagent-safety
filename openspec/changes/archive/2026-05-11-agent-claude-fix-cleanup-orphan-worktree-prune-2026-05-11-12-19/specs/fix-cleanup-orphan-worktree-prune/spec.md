# Spec Delta: gx-cleanup worktree prune

## ADDED Requirements

### Requirement: `gx cleanup` MUST treat agent state-file dirt as clean for prune purposes

The `is_clean_worktree` helper in `templates/scripts/agent-worktree-prune.sh` MUST exclude the canonical agent state-file glob list (`.omc/**`, `.omx/state/**`, `.dev-ports.json`, `apps/logs/**`, `.agents/settings.local.json`, `.codex/state/**`, `.claude/state/**`) from all three of its subchecks (working-tree diff, cached diff, untracked-files enumeration). A worktree whose only deltas relative to its HEAD match these globs MUST be classified as clean and become eligible for automatic prune. The exclude list MUST be overridable via the `GUARDEX_PRUNE_STATE_EXCLUDE_GLOBS` environment variable.

#### Scenario: Worktree with only state-file dirt is pruned

- **GIVEN** an orphan agent worktree under `.omc/agent-worktrees/` whose only working-tree changes are modifications to `.omc/state/some.json` and an untracked `apps/logs/run.log`
- **WHEN** `gx cleanup --base main` runs
- **THEN** the worktree is classified as clean
- **AND** the worktree is removed (`removed_worktrees` counter increments)

#### Scenario: Worktree with real code dirt is still skipped

- **GIVEN** an orphan agent worktree with a modified tracked file outside the state-file allowlist (e.g. `src/main.js`)
- **WHEN** `gx cleanup --base main` runs
- **THEN** the worktree is skipped as dirty (`skipped_dirty` counter increments)

#### Scenario: Override restores strict cleanliness

- **GIVEN** `GUARDEX_PRUNE_STATE_EXCLUDE_GLOBS=` (empty) is exported
- **AND** an orphan worktree with only state-file dirt
- **WHEN** `gx cleanup --base main` runs
- **THEN** the worktree is skipped as dirty (no globs excluded; pre-fix behavior preserved)

### Requirement: `gx cleanup` MUST log what's dirty when it skips a worktree

When a worktree is preserved because of dirty content (i.e., `Skipping dirty worktree (<reason>)` is printed), the script MUST also print a summary of up to 3 modified-tracked paths and up to 3 untracked paths, indented under the skip line. If more than 3 of either exist, a `(+N more)` line MUST be appended. The summary MUST honor the same state-file allowlist so it only surfaces real work.

#### Scenario: Dirt summary appears under skip-dirty line

- **GIVEN** an orphan worktree with `src/foo.js` modified and an untracked `src/new-feature.ts`
- **WHEN** `gx cleanup --base main` runs and skips the worktree as dirty
- **THEN** the log includes `Skipping dirty worktree (<reason>): <path>`
- **AND** the log includes an indented line `    modified: src/foo.js`
- **AND** the log includes an indented line `    untracked: src/new-feature.ts`

#### Scenario: Truncated summary with N-more tail

- **GIVEN** an orphan worktree with 8 modified-tracked files outside the state-file allowlist
- **WHEN** `gx cleanup --base main` runs and skips the worktree as dirty
- **THEN** the log shows 3 `modified:` lines
- **AND** a single `    modified: (+5 more)` line follows
