# Tasks

## 1. Spec

- [x] 1.1 Capture problem + approach in `proposal.md`.
- [x] 1.2 Add ADDED requirements + scenarios to `specs/gitguardex-agent-lifecycle/spec.md`.

## 2. Implementation

- [x] 2.1 `templates/scripts/agent-branch-start.sh`: flip `OPENSPEC_AUTO_INIT_RAW` default from `false` to `true` (line 12).
- [x] 2.2 `templates/scripts/agent-branch-start.sh`: rewrite end-of-run OpenSpec log block (lines 901–911) so each branch checks `$OPENSPEC_AUTO_INIT` first and prints `skipped (GUARDEX_OPENSPEC_AUTO_INIT disabled)` when the flag is off.

## 3. Verification

- [x] 3.1 `bash -n` clean on the edited script.
- [x] 3.2 Positive probe: `bash scripts/agent-branch-start.sh --tier T2 --no-transfer "<task>" "<agent>"` without setting the env var creates `openspec/changes/<slug>/{proposal.md,tasks.md,.openspec.yaml,specs/<name>/spec.md}` in the new worktree.
- [x] 3.3 Symlink check: confirm `scripts/agent-branch-start.sh` (symlink → `templates/...`) sees the fix transparently.
- [x] 3.4 Negative probe: `GUARDEX_OPENSPEC_AUTO_INIT=false bash scripts/agent-branch-start.sh ...` exits without creating the scaffold and logs `OpenSpec change: skipped (GUARDEX_OPENSPEC_AUTO_INIT disabled)`.

## 4. Cleanup

- [ ] 4.1 Commit on `agent/claude/fix-openspec-scaffold-silent-failure-2026-05-11-12-12`.
- [ ] 4.2 Push and open PR against `main`.
- [ ] 4.3 PR merged (record URL + MERGED state).
- [ ] 4.4 Sandbox worktree pruned via `gx branch finish --cleanup`.
