# Tasks

## 1. Spec

- [x] 1.1 Define the dmux-style multi-launcher behavior.
- [x] 1.2 Add normative requirements for panel rendering and repeated Codex starts.

## 2. Tests

- [x] 2.1 Cover panel rendering and selection parsing.
- [x] 2.2 Cover `gx agents start --dry-run --panel --count 3`.

## 3. Implementation

- [x] 3.1 Add a terminal selection panel renderer.
- [x] 3.2 Add multi-account launcher parsing and unique repeated-branch planning.
- [x] 3.3 Document the Codex multi-account launcher example.

## 4. Verification

- [x] 4.1 Run focused Node tests for launcher and panel behavior. Passed: `node --test test/agents-selection-panel.test.js test/agents-start-dry-run.test.js test/agents-start.test.js test/cli-args-dispatch.test.js test/agents-start-claims.test.js` (`27/27`) and smoke `node bin/multiagent-safety.js agents start "fix auth tests" --panel --codex-accounts 3 --base main --dry-run`.
- [x] 4.2 Run OpenSpec validation. Passed: `openspec validate agent-codex-dmux-codex-multi-launcher-panel-2026-04-30-09-41 --type change --strict`; `openspec validate --specs` returned `No items found to validate.` Full `npm test` completed with existing unrelated baseline failures: `374 pass`, `6 fail`.

## 5. Cleanup

- [x] 5.1 Commit, push, open PR, and merge through `gx branch finish --branch agent/codex/dmux-codex-multi-launcher-panel-2026-04-30-09-41 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 5.2 Record PR URL, `MERGED` state, and sandbox cleanup evidence.
