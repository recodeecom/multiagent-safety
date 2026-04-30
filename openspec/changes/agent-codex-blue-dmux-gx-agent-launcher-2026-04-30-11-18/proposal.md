# Blue dmux gx agent launcher

## Why

`gx agents start --panel` already supports interactive selection, but its visual shell is still a compact form. Operators expect the launcher to open like dmux: a full terminal surface with a left project rail, a matrix-style main field, a centered brand card, and keyboard-first create flow.

## What Changes

- Render the agent start panel as a dmux-style full-terminal GitGuardex shell.
- Use a blue/cyan terminal palette for the TTY surface.
- Preserve existing dry-run, multi-account planning, and keyboard selection behavior.
- Add `[n]` as a launch alias so the welcome prompt matches the dmux-style "new agent" affordance.

## Impact

The change is isolated to the `gx agents start --panel` renderer/controller and focused tests. It does not alter branch creation, lock claims, sessions, finish flow, or non-panel agent startup.
