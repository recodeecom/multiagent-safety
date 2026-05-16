# dmux pane context menu

## Problem

The GitGuardEx launcher advertises dmux/cockpit pane actions, but the reusable cockpit menu model still exposes older lane actions and does not provide the dmux-style pane menu surface requested by the launcher guidance.

## Scope

- Add a reusable terminal-only pane menu model and renderer.
- Export stable pane menu action ids for cockpit and future backend wiring.
- Represent merge and PR as pure action ids only; do not execute backend operations in this task.
- Add focused `node:test` coverage for rendering, navigation, hotkeys, selection, and cancel behavior.

## Out of scope

- No new dependencies.
- No backend execution or new action dispatcher.
- No bypass of Guardex branch/worktree/lock/PR safety.
- No direct base-branch merge path.
