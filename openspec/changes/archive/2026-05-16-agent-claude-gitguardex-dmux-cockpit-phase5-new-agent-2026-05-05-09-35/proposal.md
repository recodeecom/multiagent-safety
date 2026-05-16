# dmux-style cockpit — Phase 5: new-agent prompt overlay

## Why

Phase 1 wired the `[n]ew agent` hotkey, phase 2 advertised it on the
welcome screen, but the actual `new-agent` panel was a static info
block. Phase 5 turns it into a real input modal that captures a
prompt for the agent and emits a structured `agent:start` intent the
host shell can act on.

## What changes

- Replace `renderNewAgentPanel` with a dmux-style modal:
  - Heading `+ New Pane - <project>`
  - Project / Agent / Base info rows
  - Bordered input box with `> <typed-buffer>_` cursor
  - Footer hints `Enter to submit · Backspace to edit · Esc to cancel`
- Track `state.newAgentInput` for the typed buffer.
- In `new-agent` mode:
  - Printable ASCII (codes 0x20-0x7e) appends to the buffer.
  - Backspace (`\x7f` or `\b`) trims the last char.
  - `Enter` builds an `agent:start` intent that now carries the typed
    `task` field, then clears the buffer and returns to `main`.
  - `Esc` returns to `main` and leaves the buffer alone (cleared on
    next entry).
- Extend `buildIntent('agent:start')` to include `task` from the
  buffer alongside the existing `agent` / `base` fields.

## Impact

- Input handler runs BEFORE the global `n`/`t`/`l`/`s`/`?` shortcuts so
  typing letters lands in the prompt rather than re-opening the same
  mode or jumping to a different one.
- `Path` (`node:path`) is now imported by `control.js` for the
  project-name label in the heading.
- ASCII-only renderer; no unicode glyphs.
- No safety-model change: branches, worktrees, locks, PR-only finish
  flow are untouched.
- Host wiring of the `agent:start` intent (spawning the actual `gx
  agents start "<task>"`) is left to the existing action runner /
  cockpit shell — phase 5 is strictly the cockpit-side UX.
