# Tasks

## 1. Spec

- [x] Capture requirement delta for doctor auto-finish local fallback in `specs/doctor/spec.md`.

## 2. Tests

- [x] Add `test/doctor.test.js` case covering `doctor --allow-protected-base-write` falling back to local direct merge (no origin, no `gh`).
- [x] Add `test/doctor.test.js` case covering the auto-commit-before-merge path for a dirty agent worktree under the same local fallback.

## 3. Implementation

- [x] Replace GitHub-only early-exit gates in `autoFinishReadyAgentBranches` with a per-branch fallback-mode selection (`local` / `direct` / `pr`).
- [x] Build `finishArgs` based on fallback mode so the sweep passes `--direct-only --no-push --cleanup` when no origin, `--direct-only --cleanup` when origin is non-GitHub or `gh` is unavailable, and keeps `--via-pr --cleanup` otherwise.
- [x] Teach `scripts/agent-branch-finish.sh` + `templates/scripts/agent-branch-finish.sh` to merge directly into an existing clean base worktree when `MERGE_MODE=direct && PUSH_ENABLED=0`, avoiding the "branch already used by worktree" failure.
- [x] Export `autoCommitWorktreeForFinish` from `src/finish/index.js` and call it from the doctor sweep before the dirty-worktree skip, so the sweep now commits pending worktree changes before merging.

## 4. Verification

- [x] `node --test test/doctor.test.js` (18/19 pass; the pre-existing `agent/planner/` regex in test 9 fails locally under Claude env due to auto-claudification in `agent-branch-start.sh`, unrelated to this change).
- [x] `node --test test/finish.test.js` (16/16 pass) — direct/PR finish flows still green after the base-worktree-merge branch.

## 5. Cleanup

- [x] Commit agent branch work.
- [x] Push `agent/claude/doctor-auto-finish-local-merge-2026-04-23-21-47` and open a PR against `main`.
- [x] Record PR URL and `MERGED` evidence once merge lands.
- [x] Run `gx branch finish --branch "agent/claude/doctor-auto-finish-local-merge-2026-04-23-21-47" --base main --via-pr --wait-for-merge --cleanup` so the sandbox worktree is pruned after merge.
