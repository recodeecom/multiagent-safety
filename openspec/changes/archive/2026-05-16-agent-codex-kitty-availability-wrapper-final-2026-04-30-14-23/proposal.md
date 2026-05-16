# Kitty availability wrapper

## Why

Kitty cockpit selection needs to distinguish a missing Kitty binary from a Kitty install whose remote control is disabled. Without both checks, `auto` backend selection can treat a partially configured Kitty install as usable and operator errors are harder to act on.

## What Changes

- Add `createKittyBackend({ runtime, env })` while preserving `createBackend`.
- Probe `kitty --version` before `kitty @ ls`.
- Add `describe()` status output and dry-run command plans.
- Cover missing binary, disabled remote control, successful availability, dry-run plans, and readable errors.

## Impact

The change is limited to `src/terminal/kitty.js` and focused backend tests. Tmux behavior is unchanged.
