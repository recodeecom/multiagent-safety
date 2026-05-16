## Why

- The current `main` branch already contains the new `REPO TOGGLE` help/status copy, but package metadata is still `7.0.7`.
- The user asked for a `+1` npm version so the current branch state can be published as a fresh npm release without reusing the existing version number.
- This repo requires release notes to move in the same change as any package version bump.

## What Changes

- Bump package metadata from `7.0.7` to `7.0.8`.
- Resynchronize the root `package-lock.json` package version with `package.json`.
- Add a `README.md` release-notes entry for `v7.0.8` that documents the new `GUARDEX_ON=0` / `GUARDEX_ON=1` help output.

## Impact

- `npm publish` can target a fresh release number for the current repo state.
- Operator-facing release notes capture the new repo-toggle guidance instead of leaving the change undocumented.
