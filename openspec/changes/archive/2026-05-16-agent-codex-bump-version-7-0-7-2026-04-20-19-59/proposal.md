## Why

- The published npm version for `@imdeadpool/guardex` is `7.0.6`, so the repo needs a new publishable version before the next `npm publish`.
- The repo also requires release notes to move in the same change as any version bump, otherwise publish metadata and operator-facing release history drift apart.

## What Changes

- Bump package metadata from `7.0.6` to `7.0.7`.
- Resynchronize the root `package-lock.json` package version with `package.json`.
- Add a `README.md` release-notes entry for `v7.0.7`.

## Impact

- `npm publish` can target a fresh version number instead of colliding with the currently published package.
- No runtime behavior changes are intended; this is release metadata and documentation only.
