## Definition of Done

This change is complete only when all of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks, append a `BLOCKED:` line under section 4 explaining the blocker and stop.

## 1. Specification

- [x] 1.1 Capture Kitty welcome-first behavior.
- [x] 1.2 Define normative requirements in `specs/agents-multi-launcher/spec.md`.

## 2. Implementation

- [x] 2.1 Add a first `gx welcome` tab to generated Kitty sessions.
- [x] 2.2 Keep selected agent lanes in later Kitty tabs.
- [x] 2.3 Add focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted Node tests.
  - Evidence: `node --test test/agents-start-kitty-panel.test.js test/agents-start.test.js test/agents-start-dry-run.test.js test/agents-selection-panel.test.js` passed 21/21.
- [x] 3.2 Run `openspec validate agent-codex-kitty-welcome-first-terminal-tab-2026-04-30-14-03 --type change --strict`.
  - Evidence: change is valid.
- [x] 3.3 Run `openspec validate --specs`.
  - Evidence: no items found.

## 4. Cleanup

- [x] 4.1 Run `gx branch finish --branch agent/codex/kitty-welcome-first-terminal-tab-2026-04-30-14-03 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL and final merge state.
- [x] 4.3 Confirm sandbox worktree cleanup.
