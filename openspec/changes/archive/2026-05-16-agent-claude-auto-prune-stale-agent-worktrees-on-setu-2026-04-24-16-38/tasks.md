# Tasks

## 1. Spec

- [x] Draft delta `specs/doctor/spec.md` capturing the new auto-prune requirement for `gx setup` / `gx doctor`.

## 2. Tests

- [x] Extend `test/doctor.test.js` with an integration test: seed a repo with a detached-HEAD worktree under `.omc/agent-worktrees/`, run `gx doctor`, assert the worktree directory is gone and the stderr log contains the prune summary line.
- [x] Add a negative test: set `GUARDEX_SKIP_AUTO_WORKTREE_PRUNE=1`, assert the worktree is preserved.

## 3. Implementation

- [x] Add `pruneStaleAgentWorktrees(repoRoot, options)` helper to `src/doctor/index.js`, export it from the module.
- [x] Call the helper from the setup repo-loop after `autoFinishReadyAgentBranches` in `src/cli/main.js`.
- [x] Call the helper from the doctor single-repo path after `autoFinishReadyAgentBranches` in `src/cli/main.js`.
- [x] Add inline `printWorktreePruneSummary` helper for console output.
- [x] Thread `worktreePrune` field into doctor's JSON output payload.

## 4. Checkpoints

- [x] `node --test test/doctor.test.js` green.
- [x] `node -c src/doctor/index.js && node -c src/cli/main.js` green.

## 5. Cleanup

- [x] `gx branch finish --branch "agent/claude/auto-prune-stale-agent-worktrees-on-setu-2026-04-24-16-38" --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL and final `MERGED` evidence here.
