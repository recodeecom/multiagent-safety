## Why

- Running bare `gx` currently stops at a static degraded status summary, so humans still need a second command (`gx doctor`) to reach the actual repair path.
- That handoff feels stalled and unfriendly in the exact moment when the repo needs help, especially after the CLI already detected the drift.

## What Changes

- Let bare `gx` auto-run `gx doctor` when the repo is degraded and the shell explicitly allows interactive auto-repair.
- Keep non-interactive/default status mode safe and non-mutating, but make the degraded summary point humans at `gx doctor` instead of only `scan`.
- Add a lightweight transient prep spinner so the auto-doctor handoff looks active instead of frozen.

## Impact

- Affects only the no-argument `gx` entrypoint plus degraded-status copy; explicit `gx status` and `gx doctor` flows keep their current contracts.
- Main risk is surprise mutation from bare `gx`, so the auto-repair path stays gated behind interactive shells by default and can be forced or disabled via env for tests/operators.
- Verification needs focused CLI regression coverage because the new behavior crosses status rendering, subprocess handoff, and doctor repair output.
