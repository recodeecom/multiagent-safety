# Tasks

## 1. Spec

- [x] 1.1 Capture problem + approach in `proposal.md`.
- [x] 1.2 Add ADDED requirements + scenarios to `specs/gitguardex-agent-lifecycle/spec.md`.

## 2. Implementation

- [x] 2.1 `templates/scripts/agent-worktree-prune.sh`: add `WORKTREE_STATE_EXCLUDE_GLOBS_DEFAULT` + override env var.
- [x] 2.2 `templates/scripts/agent-worktree-prune.sh`: add `build_state_exclude_pathspec_args` helper and capture into `STATE_EXCLUDE_PATHSPEC_ARGS` array once.
- [x] 2.3 `templates/scripts/agent-worktree-prune.sh`: expand `is_clean_worktree` to apply state-exclude pathspecs to all three subchecks (working-tree diff, cached diff, untracked-files).
- [x] 2.4 `templates/scripts/agent-worktree-prune.sh`: add `summarize_worktree_dirt` helper printing top 3 modified + top 3 untracked with `(+N more)` tail.
- [x] 2.5 `templates/scripts/agent-worktree-prune.sh`: call `summarize_worktree_dirt` in the skip-dirty branch of `process_entry`.

## 3. Verification

- [x] 3.1 `bash -n` clean on the edited script.
- [x] 3.2 Live run: invoke the new script against the primary repo. 2 of the local stale worktrees correctly skipped as dirty, each with a modified-files summary listing real cockpit code (`.github/workflows/cr.yml`, `src/cockpit/control.js`, etc.) — proves the dirt summary works and the state-glob exclude doesn't mis-classify real work.
- [x] 3.3 Confirm symlink: `scripts/agent-worktree-prune.sh` (PR #548 symlink) resolves to the edited file.

## 4. Cleanup

- [ ] 4.1 Commit on `agent/claude/fix-cleanup-orphan-worktree-prune-2026-05-11-12-19`.
- [ ] 4.2 Push and open PR against `main`.
- [ ] 4.3 PR merged (record URL + MERGED state).
- [ ] 4.4 Sandbox worktree pruned via `gx branch finish --cleanup`.
