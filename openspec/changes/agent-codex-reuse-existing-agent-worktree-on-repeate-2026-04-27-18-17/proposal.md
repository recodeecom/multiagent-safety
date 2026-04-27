# Proposal: reuse the active agent worktree on branch start

`gx branch start` currently creates a fresh timestamped branch even when it is invoked from inside an existing `agent/*` worktree. That copies the active sandbox into a nested sandbox and splits follow-up work away from the lane the user selected.

- reuse the current `agent/*` worktree by default when `branch start` runs inside it
- keep an explicit `--new` / `--no-reuse` escape hatch for intentional child lanes
- preserve downstream parser compatibility for reused branch-start output
