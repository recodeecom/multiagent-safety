## Why

- The failing `Release to npm (provenance)` runs in GitHub Actions are stale release-tag executions; current `main` is green locally, and `@imdeadpool/guardex@7.0.16` is already published on npm.
- Today the workflow always executes `npm publish`, so manual verification runs or backfill GitHub releases for an already-published version would fail even when the code under test is healthy.

## What Changes

- Teach `.github/workflows/release.yml` to resolve the package name/version from `package.json`, check npm for that exact version, and skip `npm publish` when it already exists.
- Add a metadata regression test in `test/metadata.test.js` that locks the workflow's already-published skip behavior.

## Impact

- Makes the release workflow idempotent for already-published versions while preserving the existing verify steps and normal publish path for new versions.
- Lets maintainers run `workflow_dispatch` on a healthy `main` release commit without re-breaking on an already-published npm version.
