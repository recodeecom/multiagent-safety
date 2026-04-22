## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `doctor-auto-finish-manual-conflict`.
- [x] 1.2 Define normative requirements in `specs/doctor-workflow/spec.md`.

## 2. Implementation

- [x] 2.1 Reclassify recoverable doctor auto-finish rebase/merge conflicts from failed rows to manual-action skip rows.
- [x] 2.2 Keep compact default output actionable and preserve verbose raw tail text for manual conflict rows.
- [x] 2.3 Update focused doctor/install regressions for counts, detail text, and ANSI colors.

## 3. Verification

- [x] 3.1 Run focused doctor/install verification (`node --test --test-name-pattern "doctor" test/install.test.js`, `node --check bin/multiagent-safety.js`).
- [x] 3.2 Run `openspec validate agent-codex-doctor-auto-finish-manual-conflict-2026-04-22-10-42 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

Verification note: `node --check bin/multiagent-safety.js` passed. `node --test --test-name-pattern "doctor" test/install.test.js` passed with `18/18` doctor-focused tests, including the new skip/manual-conflict regressions. `openspec validate agent-codex-doctor-auto-finish-manual-conflict-2026-04-22-10-42 --type change --strict` passed, and `openspec validate --specs` returned `No items found to validate.` Extra check: `npm test` still fails on the pre-existing metadata parity assertion that `scripts/agent-branch-start.sh` diverges from `templates/scripts/agent-branch-start.sh`; this branch did not modify either file.

## 4. Completion

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.

Completion evidence:
- PR: `#277` <https://github.com/recodeee/gitguardex/pull/277>
- Final state: `MERGED` into `main` at `2026-04-22T08:50:34Z`
- Merge commit: `8a49fbaa2a9d75c9255f116733c4e563f5893ec1`
- Merge/cleanup path: `bash scripts/agent-branch-finish.sh --branch "agent/codex/doctor-auto-finish-rebase-conflict-statu-2026-04-22-10-42" --base main --via-pr --wait-for-merge --cleanup`
- Cleanup confirmation: `git worktree list` now shows only the primary repo plus one unrelated active `agent/gx/...` doctor sandbox, and `git branch -a | rg "doctor-auto-finish-rebase-conflict-statu-2026-04-22-10-42|main$|origin/main"` shows only `main` and `origin/main` after `git remote prune origin`
