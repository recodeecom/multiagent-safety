## Why

- Users need the AGENTS content that `gx setup` / `gx doctor` repair to answer two questions directly: Guardex is on by default, and `.env` can toggle it off or back on.
- The current managed AGENTS block mentions `GUARDEX_ON`, but it does not show a literal repo-root `.env` example for `GUARDEX_ON=0` and `GUARDEX_ON=1`.

## What Changes

- Extend the managed AGENTS template with explicit repo-toggle example lines.
- Keep this repo's checked-in `AGENTS.md` aligned with the template wording.
- Add regression coverage so setup/doctor refresh tests require the default-on wording plus both `.env` examples.

## Impact

- Repaired AGENTS files produced by `gx setup` / `gx doctor` will teach enable/disable behavior directly in the managed contract.
- The change is documentation-only behavior in AGENTS refresh output, with test coverage to prevent drift.
