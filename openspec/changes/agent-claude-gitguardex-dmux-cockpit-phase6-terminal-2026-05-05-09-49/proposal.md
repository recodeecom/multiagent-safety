# dmux-style cockpit — Phase 6: terminal pane action wiring

## Why

Phases 1-5 wired the dmux-style hotkeys, branded the welcome screen,
shipped the project picker, the logs viewer, and the new-agent prompt.
Each of those overlays emits a structured `lastIntent` (e.g.
`terminal:open`, `agent:start`, `project:switch`), but there was no
direct routing from those intents into the action runner — callers
had to translate intent types to action IDs themselves.

Phase 6 closes that gap so the cockpit's `[t]erminal` overlay actually
spawns a terminal pane (via `launchTerminalPane` on whichever
terminal backend the cockpit is using), and so `[n]ew agent` Enter
events land in `runAddAgent`.

## What changes

- Add aliases in `PANE_ACTION_HANDLERS` so `dispatchPaneAction` can
  route `'terminal:open'` to `runAddTerminal` and `'agent:start'` to
  `runAddAgent` directly, with no caller-side translation.
- Add a `COCKPIT_INTENT_ALIASES` map (`terminal:open → add-terminal`,
  `agent:start → add-agent`) so external dispatchers can normalize
  intent types if they prefer the action-ID surface.
- Add a `dispatchCockpitIntent(intent, context)` helper that takes
  the cockpit's `lastIntent` and dispatches it through
  `dispatchPaneAction`, merging any session/branch/worktree fields
  from the intent into the action context.
- Tests cover the alias routing, the helper, the missing-session
  fall-back to repoRoot, and the agent:start forwarding.

## Impact

- `runAddTerminal` already calls `backend.launchTerminalPane`. Aliasing
  `terminal:open` to it means cockpit's `t` overlay produces a real
  Kitty pane spawn (when the kitty backend is selected) without any
  changes to `runAddTerminal`'s implementation.
- `runAddAgent` already wraps the safe `gx agents start` workflow.
  Aliasing `agent:start` to it lets the cockpit `n` overlay drive the
  same flow directly.
- No behavior change to safety model, branches, worktrees, locks, or
  PR-only finish flow.
- Host wiring (calling `dispatchCockpitIntent` from
  `startCockpitControl`'s key loop) is left for a follow-up; this
  phase delivers the routing surface and tests.
