## Why

- `gx` can successfully install a newer global package and verify the on-disk version, then continue running the old process and print the stale in-memory CLI version in the same invocation.
- That leaves users with contradictory output such as `Updated to latest published version` followed by `CLI: ...7.0.10`, even though the global install already advanced.

## What Changes

- After a successful on-disk self-update, restart into the installed CLI instead of falling through in the old process.
- Add regression coverage for the restart handoff after a successful global install.
- Bump the package version to `7.0.12` and record the release notes in README.

## Impact

- Affects the CLI self-update path, its install tests, and release metadata only.
- The immediate user-visible change is that the first `gx` run after updating will hand off to the new installed CLI instead of showing stale version data.
