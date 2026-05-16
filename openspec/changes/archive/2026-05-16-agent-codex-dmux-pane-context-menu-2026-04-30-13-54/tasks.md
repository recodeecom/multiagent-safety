# dmux pane context menu tasks

## 1. Spec

- [x] 1.1 Define the dmux-style pane menu behavior and safety boundaries.

## 2. Tests

- [x] 2.1 Cover menu rendering, item order, hotkeys, navigation, selection, cancel, disabled status, and compatibility exports.
  - Evidence: `node --test test/cockpit-kitty-integration.test.js test/cockpit-control.test.js test/cockpit-keybindings.test.js test/cockpit-pane-menu.test.js test/cockpit-pane-actions.test.js test/cockpit-action-runner.test.js test/agents-selection-panel.test.js test/agents-start-dry-run.test.js` passed (`58/58`).
- [x] 2.2 Cover cockpit shortcut wiring for `m` and `Alt+Shift+M`.
  - Evidence: same focused command passed (`58/58`).
- [x] 2.3 Run existing focused cockpit/tmux/launcher tests.
  - Evidence: same focused command passed (`58/58`).
- [x] 2.4 Cover the safe pane action dispatcher, backend calls, unsupported status results, direct-git merge avoidance, and tmux fallback behavior.
  - Evidence: included in the focused command (`58/58`), plus full `npm test` passed (`485/486` passing, `1` skipped, `0` failing).

## 3. Implementation

- [x] 3.1 Add reusable pane menu model/rendering module.
- [x] 3.2 Keep `src/cockpit/menu.js` as a compatibility export.
- [x] 3.3 Wire cockpit control/action mapping to the pane menu without bypassing Guardex safety.
- [x] 3.4 Add `src/cockpit/pane-actions.js` as the single dispatcher for pane menu action ids, terminal backend operations, and Guardex-safe status fallbacks.

## 4. Verification

- [x] 4.1 Run `openspec validate agent-codex-dmux-pane-context-menu-2026-04-30-13-54 --type change --strict`.
  - Evidence: passed.
- [x] 4.2 Run `npm test`.
  - Evidence: passed (`485/486` passing, `1` skipped, `0` failing).

## 5. Cleanup

- [x] 5.1 Commit, push, open PR, merge, and cleanup with `gx branch finish --branch agent/codex/dmux-pane-context-menu-2026-04-30-13-54 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 5.2 Record PR URL, final `MERGED` state, and sandbox cleanup evidence.
