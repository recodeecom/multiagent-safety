## Why

- Panel launches should keep the operator on the gx welcome surface first, with launched agent lanes waiting in separate Kitty tabs.

## What Changes

- Add a first `gx welcome` tab to generated Kitty session files.
- Keep selected agent lanes as their own Kitty tabs after the welcome tab.
- Preserve non-panel single-agent starts and `--terminal none` behavior.

## Impact

- Affects generated Kitty session files for `gx agents start --panel`.
- Does not change branch creation, lock claims, session metadata, or non-Kitty terminals.
