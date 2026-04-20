## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-doctor-agents-toggle-example-2026-04-20-20-39`.
- [x] 1.2 Define normative requirements in `specs/doctor-agents-toggle-guidance/spec.md`.

## 2. Implementation

- [x] 2.1 Update the managed AGENTS template so it states Guardex is enabled by default and shows repo-root `.env` examples for `GUARDEX_ON=0` and `GUARDEX_ON=1`.
- [x] 2.2 Keep the repo's checked-in `AGENTS.md` aligned with the template wording.
- [x] 2.3 Extend the AGENTS refresh regression tests to require the new toggle guidance.

## 3. Verification

- [x] 3.1 Run targeted verification commands (`node --test --test-name-pattern='setup refreshes existing managed AGENTS block by default|doctor refreshes existing managed AGENTS block by default' test/install.test.js`).
- [x] 3.2 Run `openspec validate agent-codex-doctor-agents-toggle-example-2026-04-20-20-39 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Completion

- [ ] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
