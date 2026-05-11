# Tasks

## 1. Spec

- [x] 1.1 Capture problem and approach in `proposal.md`.
- [x] 1.2 Add requirements + scenarios to `specs/gitguardex-agent-lifecycle/spec.md`.

## 2. Implementation

- [x] 2.1 `scripts/agent-branch-start.sh`: add `AUTO_TRANSFER_ENABLED_RAW`, `AUTO_TRANSFER_EXCLUDE_RAW`, and `AUTO_TRANSFER_EXCLUDE_DEFAULT` env defaults.
- [x] 2.2 `scripts/agent-branch-start.sh`: add `--no-transfer`, `--transfer`, `--transfer-exclude` flags.
- [x] 2.3 `scripts/agent-branch-start.sh`: build `git stash push` argv with `:/` + `:(exclude,glob)<pattern>` magic pathspecs from the exclude list (no shell glob expansion).
- [x] 2.4 `scripts/agent-branch-start.sh`: log when no transfer happens because everything was excluded.
- [x] 2.5 `scripts/agent-branch-finish.sh`: add `--auto-resolve[=none|safe]`, `--no-auto-resolve` flags and `GUARDEX_FINISH_AUTO_RESOLVE` env default.
- [x] 2.6 `scripts/agent-branch-finish.sh`: add `path_matches_auto_resolve_safe_glob` matcher (subtree `<dir>/**` + exact-glob).
- [x] 2.7 `scripts/agent-branch-finish.sh`: extend preflight conflict block to walk conflicts, resolve safe paths via `--theirs`, abort on unallowed paths, claim resolved paths via `gx locks claim`, then commit the merge (no `--no-verify`).
- [x] 2.8 `scripts/agent-branch-finish.sh`: surface `--auto-resolve=safe` hint in the abort message.

## 3. Tests

- [x] 3.1 Pathspec exclude unit test: dirt under `.omc/**` and `apps/logs/**` stays on the protected branch; tracked + unrelated untracked files transfer.
- [x] 3.2 `path_matches_auto_resolve_safe_glob` unit test: 13 cases covering subtree matches, exact-name matches, and near-miss prefixes (`.omc` vs `.omcx`).
- [x] 3.3 Integration test: merge with one state-file conflict and one code conflict ⇒ resolver classifies state file as resolved, refuses code file.
- [x] 3.4 Arg-parser smoke: `--auto-resolve=safe`, `--auto-resolve=bogus`, `--no-auto-resolve` all parse correctly and validation rejects unknown modes.
- [x] 3.5 `bash -n` syntax check both scripts clean.

## 4. Verification

- [x] 4.1 Reproduce the leak: start an agent worktree from a dirty protected branch and confirm post-fix that state-file dirt remains on the protected branch instead of migrating.

## 5. Cleanup

- [ ] 5.1 Commit changes on `agent/claude/fix-guardex-dirty-tree-sweep-leak-2026-05-11-10-12`.
- [ ] 5.2 Push branch and open PR against `main`.
- [ ] 5.3 PR merged (record URL + `MERGED` state).
- [ ] 5.4 Sandbox worktree pruned via `gx branch finish --cleanup`.
