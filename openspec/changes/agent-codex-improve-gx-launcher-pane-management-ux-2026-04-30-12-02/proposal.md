## Why

- The `gx` zero-argument launcher opens a terminal panel, but the right side was decorative and the visible `[t]erminal` / pane-management cues did not explain how they map to the existing dmux cockpit controls.
- Users need the launcher home to behave like a compact pane-management command surface: clear task entry, clear selected agent state, and visible dmux pane shortcuts without moving focus to a separate sidebar first.

## What Changes

- Replace the decorative launcher body with a bounded Pane Management shortcut map modeled on the existing `gx cockpit`/dmux commands.
- Clarify task-input mode versus launch/action mode so typing a task is not confused with terminal pane shortcuts.
- Add reducer coverage for `?`, terminal guidance, and `Alt+Shift+M` pane-menu guidance.

## Impact

- Affects only the terminal launcher render/reducer and focused tests.
- Does not create new terminal-pane runtime behavior; terminal and pane-management actions point users to the existing `gx cockpit` surface.
