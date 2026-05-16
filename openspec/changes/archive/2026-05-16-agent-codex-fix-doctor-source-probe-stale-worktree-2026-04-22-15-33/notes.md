# agent-codex-fix-doctor-source-probe-stale-worktree-2026-04-22-15-33 (minimal / T1)

Branch: `agent/codex/fix-doctor-source-probe-stale-worktree-2026-04-22-15-33`

`gx doctor` can surface or reuse leaked `__source-probe-*` worktrees during the auto-finish sweep. That makes VS Code Source Control show a fake extra repo, can block `gx branch finish` on a dirty probe, and the compact doctor copy wrongly implies the throwaway probe is the place to keep rebasing.

Scope:
- Treat `__source-probe-*` paths as temporary worktrees even when they track an `agent/*` branch.
- Remove stale source-probe worktrees before `agent-branch-finish.sh` creates a fresh probe for the branch.
- Update doctor conflict copy so the operator rebases the real branch in a normal worktree instead of treating the probe as durable state.
- Add focused regressions for doctor output, stale-probe finish recovery, and worktree prune behavior.

Verification:
- `bash -n scripts/agent-branch-finish.sh scripts/agent-worktree-prune.sh templates/scripts/agent-branch-finish.sh templates/scripts/agent-worktree-prune.sh`
- `node --test test/doctor.test.js test/worktree.test.js test/finish.test.js`

## Cleanup

- [x] Run `gx branch finish --branch agent/codex/fix-doctor-source-probe-stale-worktree-2026-04-22-15-33 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
