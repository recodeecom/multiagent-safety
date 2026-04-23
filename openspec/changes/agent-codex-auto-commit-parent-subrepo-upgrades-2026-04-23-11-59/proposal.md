# Change: Auto-Commit Parent Subrepo Gitlink Upgrades

## Why

When a nested repo finishes and updates its base branch, the containing repo can be left with a changed gitlink entry. In VS Code this shows up as staged or unstaged subrepo entries that need a second manual commit even though the nested finish flow already completed.

## What Changes

- Extend `agent-branch-finish` so, after a successful nested repo finish and base-worktree fast-forward, it detects a tracked superproject gitlink and commits only that subrepo pointer in the parent repo.
- Add `--parent-gitlink-commit` / `--no-parent-gitlink-commit` and `GUARDEX_FINISH_PARENT_GITLINK_AUTO_COMMIT` controls.
- Keep the commit path-scoped to the single gitlink so unrelated parent staged changes are not bundled.

## Risks

- Parent repo hooks may reject the auto-commit on protected branches. The finish flow should warn and continue rather than treating the nested repo finish as failed.
