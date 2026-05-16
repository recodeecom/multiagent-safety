## 1. Spec

- [x] Capture panel-launched Kitty terminal behavior.

## 2. Tests

- [x] Cover single-agent panel launch opening Kitty.
- [x] Cover direct single-agent start staying non-terminal.

## 3. Implementation

- [x] Route successful single-lane panel starts through the existing Kitty session launcher.
- [x] Preserve existing multi-agent Kitty behavior and non-panel single-agent behavior.

## 4. Verification

- [x] Run focused Node tests for start/panel terminal behavior.
  - Evidence: `node --test test/agents-start-kitty-panel.test.js test/agents-start.test.js test/agents-start-dry-run.test.js test/agents-selection-panel.test.js` passed 21/21.
- [x] Run OpenSpec validation.
  - Evidence: `openspec validate agent-codex-kitty-gx-window-terminal-2026-04-30-13-36 --strict` passed.
  - Evidence: `openspec validate --specs` passed with no spec items found.

## 5. Cleanup

- [x] Commit changes.
- [x] Finish via PR, wait for merge, cleanup, and record `MERGED` evidence.
