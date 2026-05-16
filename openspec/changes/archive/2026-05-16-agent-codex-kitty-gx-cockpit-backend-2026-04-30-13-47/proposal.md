# Kitty-backed cockpit terminal backend

## Why

`gx cockpit` is currently coupled to tmux session creation. The cockpit needs a terminal backend boundary so Kitty remote-control windows can drive the new cockpit surface while tmux remains available and compatible.

## What Changes

- Add a `src/terminal` backend abstraction with Kitty and tmux implementations.
- Add dry-run-testable Kitty command builders for cockpit, agent pane, terminal pane, focus, close, and send-text actions.
- Add `gx cockpit --backend kitty|tmux|auto`; auto prefers Kitty when remote control responds and otherwise uses tmux.
- Keep current tmux behavior and cockpit shortcut coverage intact.

## Impact

The change is limited to cockpit terminal launching and command construction. Agent worktree creation, locks, PR finish flow, and existing tmux session helpers remain unchanged.
