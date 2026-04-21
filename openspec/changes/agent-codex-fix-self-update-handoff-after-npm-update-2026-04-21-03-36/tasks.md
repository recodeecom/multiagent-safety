## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-fix-self-update-handoff-after-npm-update-2026-04-21-03-36`.
- [x] 1.2 Define normative requirements in `specs/self-update/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-fix-self-update-handoff-after-npm-update-2026-04-21-03-36 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Completion

- [ ] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
