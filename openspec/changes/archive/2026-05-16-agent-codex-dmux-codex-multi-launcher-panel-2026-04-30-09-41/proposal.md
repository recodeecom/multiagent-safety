# dmux Codex multi launcher panel

## Why

Operators want the Guardex terminal cockpit to feel closer to dmux when launching agents: one compact panel should show selected agent rows and launcher settings, and Codex should support more than one account/lane for the same task without branch-name collisions.

## What Changes

- Add a terminal-style agent selection panel for `gx agents start --panel`.
- Add `--count`, `--codex-count`, `--codex-accounts`, and `--agents codex:3,claude` launcher options.
- Ensure repeated Codex launches derive unique branch tasks while preserving the original prompt text for the agent.

## Impact

- Affects the `gx agents start` CLI surface and dry-run output.
- Does not add dependencies or replace the existing cockpit/tmux behavior.
