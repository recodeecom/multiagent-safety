## Why

- The repo changed `package.json.name` to `@imdeadpool/gitguardex`, but npm treats a package name change as a different package identity, not a rename of the existing registry entry.
- The live npm registry still serves `@imdeadpool/guardex@7.0.16`, while `npm view @imdeadpool/gitguardex version` returns `404`.
- README, tutorial, Reddit kit, and self-update expectations now point at a package name that is not the install target users actually have.

## What Changes

- Restore the published package metadata to `@imdeadpool/guardex`.
- Bump the package version from `7.0.16` to `7.0.17` so the next publish is valid against the existing `@imdeadpool/guardex@7.0.16` release.
- Refresh install, self-update, tutorial, and README-linked asset surfaces to reference `@imdeadpool/guardex`.

## Compatibility

- Keep `gx` as the preferred short command.
- Keep `gitguardex` as the long-form command and product/repo brand.
- Keep `guardex` as the legacy compatibility bin alias.
