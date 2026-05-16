## 1. Spec

- [x] Capture Kitty binary, remote-control, status, and dry-run requirements.

## 2. Tests

- [x] Cover missing Kitty binary.
- [x] Cover failing `kitty @ ls`.
- [x] Cover successful availability.
- [x] Cover dry-run planned commands.
- [x] Cover readable remote-control errors.

## 3. Implementation

- [x] Add `createKittyBackend({ runtime, env })` while keeping `createBackend` compatible.
- [x] Check `kitty --version` before `kitty @ ls`.
- [x] Add `describe()` status and dry-run command plans.
- [x] Leave tmux behavior untouched.

## 4. Verification

- [x] `node --test test/cockpit-terminal-backend.test.js test/cockpit-command.test.js test/tmux-command.test.js` passed 23/23.
- [x] `openspec validate agent-codex-kitty-availability-wrapper-final-2026-04-30-14-23 --strict` passed.

## 5. Cleanup

- [x] Commit changes.
- [x] Finish via PR, wait for merge, cleanup, and record `MERGED` evidence.
