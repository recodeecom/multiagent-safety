## Why

- The current `main` branch already contains the AGENTS refresh that teaches `GUARDEX_ON=0` and `GUARDEX_ON=1`, but package metadata is still `7.0.8`.
- The user asked for one more npm version bump so the current branch state can be published as a fresh npm release without reusing the already-published version.
- This repo requires release notes to move in the same change as any package version bump.

## What Changes

- Bump package metadata from `7.0.8` to `7.0.9`.
- Resynchronize the root `package-lock.json` package version with `package.json`.
- Add a `README.md` release-notes entry for `v7.0.9` that documents the AGENTS toggle examples refreshed by `gx doctor` / `gx setup`.

## Impact

- `npm publish` can target a fresh release number for the current repo state.
- Operator-facing release notes capture the AGENTS toggle guidance instead of leaving the publishable change undocumented.
