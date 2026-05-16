# agent-codex-dry-run-testable-kitty-command-builders-2026-04-30-14-10 (minimal / T1)

- Add pure Kitty remote-control command builders in `src/terminal/kitty.js` for launch, focus, close, send-text, ls, and version probes.
- Keep commands as `{ cmd, args }` argv arrays with optional stdin `input`; do not require a live Kitty instance to test construction.
- Support cwd/title values with spaces, deterministic env ordering, command argv, id/title matches, control windows, and agent pane launches.
- Verification:
  - `node --test test/terminal-kitty.test.js test/cockpit-terminal-backend.test.js`
  - `openspec validate --specs`
  - `git diff --check`
  - `npm test` ran 446 tests: 438 pass, 7 baseline failures, 1 skip. Failures are in `test/agents-launch.test.js`, `test/agents-lifecycle.test.js`, and `test/agents-sessions.test.js`.
