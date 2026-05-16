## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-restore-cleanup-pr-merged-flag-2026-04-21-09-53`.
- [x] 1.2 Define normative requirements in `specs/cleanup/spec.md`.

## 2. Implementation

- [x] 2.1 Restore explicit `--include-pr-merged` support in the prune script and packaged template.
- [x] 2.2 Keep cleanup CLI/tests aligned with the restored script behavior.

## 3. Verification

- [x] 3.1 Run targeted cleanup regression coverage.
- [x] 3.2 Run the reproduced red local CI subset plus static/package verification commands.
- [x] 3.3 Run `openspec validate agent-codex-restore-cleanup-pr-merged-flag-2026-04-21-09-53 --type change --strict`.
- [x] 3.4 Run `openspec validate --specs`.

## 4. Completion

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
