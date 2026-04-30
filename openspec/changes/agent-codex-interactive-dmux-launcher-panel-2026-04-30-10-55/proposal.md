# Interactive dmux launcher panel

## Why

`gx agents start --panel` currently prints a static panel and then immediately prints launch plans. The panel advertises keyboard controls, but operators cannot actually use arrows, Space, plus/minus, Enter, or ESC in the terminal the way dmux-style launchers do.

## What Changes

- Make `gx agents start <task> --panel` open an interactive terminal panel when stdin/stdout are TTYs.
- Keep non-TTY and scripted behavior unchanged.
- Let Enter either print dry-run plans or create lanes depending on `--dry-run`.
- Keep ESC/Ctrl-C as cancel without creating work.

## Impact

The CLI start path and panel renderer gain interactive behavior. Existing dry-run output remains available for scripts and tests.
