# Tasks

## 1. Spec

- [x] 1.1 Capture interactive terminal-panel behavior.

## 2. Tests

- [x] 2.1 Cover panel key handling.
- [x] 2.2 Cover interactive dry-run launch output.

## 3. Implementation

- [x] 3.1 Add panel state and key reducer.
- [x] 3.2 Route TTY `gx agents start --panel` through the interactive controller.
- [x] 3.3 Preserve non-TTY/static dry-run output.

## 4. Verification

- [x] 4.1 Run focused Node tests.
- [x] 4.2 Validate OpenSpec.

## 5. Cleanup

- [x] 5.1 Commit, push, PR, merge, and cleanup the agent worktree.
  - Evidence: PR #489 merged as https://github.com/recodeee/gitguardex/pull/489 with merge commit `b1e0a8c3880e7bb89e24db1c5db4c6b0dbe7c199`.
- [x] 5.2 Record merged PR URL and final cleanup evidence.
  - Evidence: `gx cleanup --base main` removed `/home/deadpool/Documents/recodee/gitguardex/.omx/agent-worktrees/gitguardex__codex__interactive-dmux-launcher-panel-2026-04-30-10-55`; `git worktree list` showed only the main checkout, and local/remote source branch lookups returned no branch.
