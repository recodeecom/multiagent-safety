## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-tolerate-already-deleted-local-branch-in-2026-04-22-20-43`.
- [x] 1.2 Define normative requirements in `specs/workflow-guardrails/spec.md`.

## 2. Implementation

- [x] 2.1 Update `scripts/agent-branch-finish.sh` so post-merge cleanup tolerates an already-missing local source branch.
- [x] 2.2 Mirror the same finish cleanup change into `templates/scripts/agent-branch-finish.sh`.
- [x] 2.3 Add a focused regression in `test/finish.test.js` for the local-branch-already-deleted race.

## 3. Verification

- [x] 3.1 Run focused finish verification (`node --test test/finish.test.js`, `node --check bin/multiagent-safety.js`).
- [x] 3.2 Run parity verification (`node --test test/metadata.test.js`).
- [x] 3.3 Run `openspec validate agent-codex-tolerate-already-deleted-local-branch-in-2026-04-22-20-43 --type change --strict`.
- [x] 3.4 Run `openspec validate --specs`.

## 4. Completion

- [ ] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
