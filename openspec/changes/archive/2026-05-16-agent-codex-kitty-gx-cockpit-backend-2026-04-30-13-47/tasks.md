## 1. Spec

- [x] Capture Kitty/tmux cockpit backend selection and command-builder requirements.

## 2. Tests

- [x] Cover backend selection preferring Kitty when available and falling back to tmux.
- [x] Cover stable Kitty command construction.
- [x] Keep tmux cockpit command tests passing.
- [x] Verify cockpit shortcut tests remain green.

## 3. Implementation

- [x] Add terminal backend abstraction files under `src/terminal/`.
- [x] Wire `gx cockpit --backend kitty|tmux|auto`.
- [x] Preserve existing cockpit keybinding behavior without editing actively owned keybinding files.
  - Note: `src/cockpit/keybindings.js` was actively owned by session `019dde2a`; this change leaves it untouched and verifies existing coverage.

## 4. Verification

- [x] Run focused Node tests for cockpit terminal backends, cockpit command behavior, keybindings, and tmux helpers.
  - Evidence: `node --test test/cockpit-terminal-backend.test.js test/cockpit-command.test.js test/tmux-session.test.js test/cockpit-keybindings.test.js` passed 21/21 after stashing unrelated inherited dirty files.
- [x] Run OpenSpec validation.
  - Evidence: `openspec validate agent-codex-kitty-gx-cockpit-backend-2026-04-30-13-47 --strict` passed.
  - Evidence: `openspec validate --specs` passed with no spec items found.

## 5. Cleanup

- [x] Commit changes.
- [x] Finish via PR, wait for merge, cleanup, and record `MERGED` evidence.
