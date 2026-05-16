## Why

- The working tree on `main` contained staged/unstaged frontend export updates that needed to be shipped.
- The user requested a PR merge into `main` from a separate worktree branch.

## What Changes

- Move the current `main` working-copy changes to an isolated `agent/*` worktree branch.
- Preserve updated frontend UI files and Recodee plan export artifacts.

## Impact

- This introduces a large artifact bundle under `frontend/recodeeplan/**` plus one tarball handoff file.
- Verification in this environment is limited because `next` is unavailable in PATH for lint execution.
