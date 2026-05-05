# dmux-style cockpit — Phase 1: top-bar shortcut row

## Why

Users want `gx` (or `gx cockpit`) to look and feel like dmux — a TUI
multiplexer with a sidebar that exposes `[n]ew agent`, `[t]erminal`,
`[l]ogs`, `[p]rojects` as one-key shortcuts. Today the cockpit only
shows `[n]ew agent` and `[t]erminal`; `l` and `p` aren't wired and
there are no logs/projects modes.

This change is phase 1 of a 5-6 PR plan that ends with full dmux
parity (logs viewer, project picker, branded welcome). Phase 1 lands
the top-bar surface, modes, and key dispatch so later phases only need
to fill in the actual log/project content.

## What changes

- Sidebar shortcut block expands from 2 rows to 3 rows. New row:
  `[l]ogs       [p]rojects`.
- New cockpit modes: `logs`, `projects`. Routed by `openActionRow`.
- Key dispatch: `l` always opens the logs panel; `p` opens the
  projects panel **only when no lane is selected** (otherwise the
  existing pane menu `p` action — "Create GitHub PR" — still wins).
- Two new placeholder panels render when those modes are active. They
  describe what later phases will fill in (log filters, project
  picker), so users see something visible the moment they press the
  hotkey.
- Shortcuts help text updated to list `l` and `p`.

## Impact

- 2 new modes in `MODES`, 2 new entries in `EMPTY_ACTION_ROWS`.
- `applyKey` adds an action-scope `p` branch before the existing
  `DIRECT_DETAIL_PANE_KEYS` block so PR-on-lane behavior is preserved.
- Existing snapshot test for the 2-row shortcut block updated to the
  3-row layout.
- No behavior change to safety model, branches, worktrees, locks, or
  PR-only finish flow.

## Out of scope (later phases)

- Phase 2: Welcome screen redesign + gitguardex ASCII brand.
- Phase 3: Project picker overlay (scan workspace for git repos).
- Phase 4: Logs viewer overlay (tail `apps/logs/*.log`, lane events).
- Phase 5: New-agent prompt overlay wrapping `gx agents start`.
- Phase 6: Terminal pane action wired to top-bar `t` (currently opens
  the existing terminal mode that already routes to Kitty).
