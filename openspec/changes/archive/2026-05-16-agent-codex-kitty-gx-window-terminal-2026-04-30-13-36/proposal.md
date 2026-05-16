# Kitty gx window terminal follow-up

## Why

The dmux-style `gx agents start --panel` shell can launch a single selected agent, but single-panel launches still leave the operator in the original shell without opening the new agent lane in Kitty. The visual flow should keep the same GitGuardex panel style while using Kitty as the terminal surface for launched lanes.

## What Changes

- Open a generated Kitty session after a successful single-lane panel launch.
- Preserve direct non-panel single starts so automation does not unexpectedly open a terminal.
- Keep `--terminal none` behavior routed through the existing Kitty launcher skip path.

## Impact

The change is limited to panel-driven agent starts and focused tests. It does not change branch creation, locks, session metadata, multi-agent behavior, or finish cleanup.
