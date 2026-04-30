## 1. Spec

- [x] Record Kitty-first multi-agent terminal launcher scope.

## 2. Tests

- [x] Cover default `kitty` parsing.
- [x] Cover `--terminal none` skipping terminal launch.
- [x] Cover missing Kitty recovery output.
- [x] Cover launcher panel copy update.

## 3. Implementation

- [x] Add `src/agents/terminal.js`.
- [x] Wire `gx agents start` multi-lane success into Kitty launch after lane creation.
- [x] Add parser support for `--terminal`.
- [x] Update panel text from tmux-focused wording to Kitty-first wording.

## 4. Verification

- [x] Run focused Node tests for parser, launcher, panel.
- [x] Run `openspec validate --specs`.

Evidence:

- `node --test test/cli-args-dispatch.test.js test/agents-start.test.js test/agents-selection-panel.test.js test/agents-start-dry-run.test.js` -> 30 pass.
- `openspec validate agent-codex-kitty-default-agent-terminal-2026-04-30-13-14 --strict` -> valid.
- `openspec validate --specs` -> no spec items found.
- `npm test` -> 423 pass, 9 fail, 1 skip; failures were pre-existing-looking baseline mismatches outside this touched scope (`test/agents-launch.test.js`, `test/agents-lifecycle.test.js`, `test/agents-sessions.test.js`, `test/cockpit-command.test.js`).

## 5. Cleanup

- [x] Commit changes.
- [ ] Finish via PR, wait for merge, cleanup, and record `MERGED` evidence.
