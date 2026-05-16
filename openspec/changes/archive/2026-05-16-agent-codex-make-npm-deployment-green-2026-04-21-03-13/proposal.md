## Why

- The published `v7.0.10` release already exists on npm, but the GitHub `npm` deployment is still red because the release workflow ran from a failing tag-era commit.
- The release workflow also double-triggers on both tag push and release publication, which leaves duplicate cancelled deployment cards in the `npm` environment even when the real release run is the one that matters.

## What Changes

- Bump the package metadata to `7.0.11` and add matching README release notes so the next publish targets a fresh npm version.
- Limit the npm publish workflow to `release.published` and explicit manual dispatch so GitHub only records one canonical release deployment per version.
- Add regression coverage that keeps the workflow on the single-release path.

## Impact

- Affects the package manifest, README release notes, release workflow trigger shape, and metadata regression tests.
- Next step after merge is to publish a new GitHub release/tag so the corrected workflow produces the green npm deployment.
