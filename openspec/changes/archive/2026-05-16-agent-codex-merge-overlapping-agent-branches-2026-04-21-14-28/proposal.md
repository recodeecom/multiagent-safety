## Why

- GitGuardex currently finishes one `agent/*` branch into the base branch at a time, but it does not provide an integration workflow for the common case where multiple agent worktrees touched the same implementation files.
- In that situation users end up staring at several parallel worktrees with overlapping edits and no first-class Guardex command that creates the right integration branch/worktree, reports overlap, and gives a safe place to resolve conflicts.
- OpenSpec already treats implementation as owner/helper lanes with durable artifacts, so the merge workflow should preserve that model instead of pushing users back to ad hoc manual git work on the protected base.

## What Changes

- Add a first-class `gx merge` command plus a managed `scripts/agent-branch-merge.sh` workflow.
- Let the workflow either create a fresh integration `agent/*` branch/worktree from the configured base branch or merge helper branches into an existing owner branch via `--into`.
- Report overlapping changed files across the requested source branches before merging so users can see where collisions are expected, especially inside shared implementation files and OpenSpec surfaces.
- Merge branches in explicit order, stop on conflicts without touching the protected base branch, and print resumable instructions that keep conflict resolution inside the integration worktree.
- Ship the new script through the setup/templates/package metadata path so downstream repos get the same capability.

## Impact

- Affected surfaces: `gx` CLI command catalog, managed workflow scripts/templates, setup/doctor script expectations, and regression tests.
- Risk: merge automation is sensitive to dirty worktrees and stale branches, so the implementation needs strict preflight checks and clear conflict-stop behavior.
- Rollout: local CLI/script addition only; no data migration.
