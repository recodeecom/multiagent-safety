## Why

In monorepo shops (`medusa-shops/lifted`, `compastor`, etc.) the parent repo pins `apps/backend` and `apps/storefront` as submodules. When an agent's lane includes both code edits AND new commits in submodules, the user has to run `gx submodule advance` (Phase B) as a separate step before finishing the lane — otherwise the parent PR ships with stale submodule pointers and reviewers see "no actual change."

## What Changes

- Add `--advance-submodules` / `--no-advance-submodules` to `gx branch finish`. Default off.
- When `--advance-submodules` is passed AND the worktree has `.gitmodules`, the finish flow runs `submoduleModule.advance({ commit: true })` on the lane *before* spawning `agent-branch-finish.sh`. Pointer bumps land as a commit on the agent's branch, so the resulting PR contains the user's code edits + the pointer bumps in one atomic unit.
- In `--dry-run` mode, the advance preview is printed without mutating anything.
- If the worktree has no `.gitmodules`, the flag is logged as ignored and finish proceeds normally.

## Impact

- Opt-in flag: no behavior change for non-monorepo lanes or for users who don't pass the flag.
- Uses the existing `submoduleModule.advance` plumbing (Phase B) — already battle-tested via PR #558.
- Safety: advance refuses to commit if any submodule is dirty or if the lane's working tree has unrelated changes, so the existing finish gates aren't bypassed.
- Future: `--advance-submodules` could become the default for repos with `.gitmodules` once we're confident in the flow.
