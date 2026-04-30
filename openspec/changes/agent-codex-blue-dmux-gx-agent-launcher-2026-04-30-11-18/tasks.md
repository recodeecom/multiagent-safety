# Tasks

## 1. Spec

- [x] 1.1 Capture dmux-style blue launcher behavior.

## 2. Tests

- [x] 2.1 Cover dmux shell rendering and blue ANSI output.
- [x] 2.2 Cover `[n]` launch key alias.
- [x] 2.3 Run focused launcher tests.

## 3. Implementation

- [x] 3.1 Replace compact default panel with dmux-style terminal shell.
- [x] 3.2 Pass TTY dimensions/color into the interactive renderer.
- [x] 3.3 Preserve compact renderer as an explicit compatibility path.

## 4. Verification

- [x] 4.1 Run focused Node tests.
  - Evidence: `node --test test/agents-selection-panel.test.js test/agents-start-dry-run.test.js test/agents-start.test.js test/cli-args-dispatch.test.js test/agents-start-claims.test.js` passed (`30/30`).
- [x] 4.2 Validate OpenSpec change.
  - Evidence: `openspec validate agent-codex-blue-dmux-gx-agent-launcher-2026-04-30-11-18 --type change --strict` passed.
- [x] 4.3 Smoke `gx agents start "fix auth tests" --panel --codex-accounts 3 --base main --dry-run`.
  - Evidence: `node bin/multiagent-safety.js agents --target /home/deadpool/Documents/recodee/gitguardex start "fix auth tests" --panel --codex-accounts 3 --base main --dry-run` rendered the blue dmux-style GitGuardex shell and planned three dry-run lanes without creating branches/worktrees.

## 5. Cleanup

- [ ] 5.1 Run the finish pipeline: `gx branch finish --branch agent/codex/blue-dmux-gx-agent-launcher-2026-04-30-11-18 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 5.2 Record PR URL, final `MERGED` state, and sandbox cleanup evidence.
