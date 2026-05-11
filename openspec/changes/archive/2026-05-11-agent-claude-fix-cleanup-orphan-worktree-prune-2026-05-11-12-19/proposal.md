# Proposal: make `gx cleanup` dirt-aware of state-file globs + log why a worktree was kept

## Problem

Two related shortcomings in `templates/scripts/agent-worktree-prune.sh` made `gx cleanup` less useful than it should be:

1. **State-file dirt was misclassified as real work.** `is_clean_worktree()` excluded exactly one path from its dirty check — `.omx/state/agent-file-locks.json` — and treated everything else as if it were authoritative content. A worktree with nothing dirty but agent state (`.omc/state/*.json`, `.omx/state/*.json`, `apps/logs/*.log`, `.dev-ports.json`) was therefore tagged "dirty" and skipped, leaving orphans on disk that the user had to delete manually. This contradicts the allowlist established by PRs #546 / #547.

2. **The skip-dirty log was opaque.** When a worktree was preserved, the script printed `Skipping dirty worktree (<reason>): <path>` and nothing else. With multiple stale worktrees accumulated (8 locally at audit start), per-worktree `cd + git status` was the slow path.

## Approach

One file touched: `templates/scripts/agent-worktree-prune.sh` (the runtime canonical script; `scripts/agent-worktree-prune.sh` is a symlink to it as of PR #548).

### 1. Expand the cleanliness check to honor the shared state-file allowlist

Introduce `WORKTREE_STATE_EXCLUDE_GLOBS_DEFAULT` with the same colon-separated list used by PR #546 (`GUARDEX_AUTO_TRANSFER_EXCLUDE`) and PR #547 (`GUARDEX_FINISH_AUTO_RESOLVE_SAFE_GLOBS`): `.omc/**:.omx/state/**:.dev-ports.json:apps/logs/**:.agents/settings.local.json:.codex/state/**:.claude/state/**`. Convert to `:(exclude,glob)<pattern>` pathspec args once at startup, pass them to all three `is_clean_worktree` subchecks (working-tree diff, cached diff, untracked enumeration).

A worktree whose only deltas are agent state files is now considered clean and gets pruned. Override via `GUARDEX_PRUNE_STATE_EXCLUDE_GLOBS`.

### 2. Add `summarize_worktree_dirt()`, wire it into the skip-dirty branch

When the prune loop skips a dirty worktree, the helper prints up to 3 modified-tracked paths and up to 3 untracked paths (with `(+N more)` tail), using the same state-file excludes so the summary only surfaces work the user cares about. Indented under the existing `Skipping dirty worktree` line.

## Compatibility

- Worktrees with state-file-only dirt are now auto-pruned. `.omc/` and `.omx/state/**` are gitignored per CLAUDE.md and have no authoritative value.
- Worktrees with real code dirt remain skipped; the new diagnostic surfaces which files.
- Env override (`GUARDEX_PRUNE_STATE_EXCLUDE_GLOBS=`) restores strict behavior.
- No CLI surface change.

## Risks

- A user storing local-only notes under `.omc/` would see them deleted at prune. Mitigated by CLAUDE.md's "Never stage or commit: .omc/state/**, .omx/state/**" rule — those paths were always agent-only.
- `summarize_worktree_dirt` runs `git diff` / `git ls-files` twice each per skipped worktree (paths + count). Negligible at typical counts.
