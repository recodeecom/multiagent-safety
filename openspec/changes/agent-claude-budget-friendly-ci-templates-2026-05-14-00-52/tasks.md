## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-claude-budget-friendly-ci-templates-2026-05-14-00-52`; branch=`agent/claude/budget-friendly-ci-templates-2026-05-14-00-52`; scope=`TODO`; action=`continue this sandbox or finish cleanup after a usage-limit/manual takeover`.
- Copy prompt: Continue `agent-claude-budget-friendly-ci-templates-2026-05-14-00-52` on branch `agent/claude/budget-friendly-ci-templates-2026-05-14-00-52`. Work inside the existing sandbox, review `openspec/changes/agent-claude-budget-friendly-ci-templates-2026-05-14-00-52/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/claude/budget-friendly-ci-templates-2026-05-14-00-52 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria — see `proposal.md`.
- [x] 1.2 Define normative requirements in `specs/ci-workflow-budget/spec.md`.

## 2. Implementation

- [x] 2.1 Trim live workflows: `ci.yml`, `ci-full.yml` (new), `codeql.yml`, `cr.yml`, `scorecard.yml`.
- [x] 2.2 Seed `templates/github/workflows/` with `ci.yml`, `ci-full.yml`, `cr.yml`, and `README.md` carrying the same budget posture.

## 3. Verification

- [x] 3.1 `npm test` green; `bash scripts/check-script-symlinks.sh` green.
- [x] 3.2 `js-yaml` parse over all 8 modified/new workflow files.
- [ ] 3.3 Run `openspec validate agent-claude-budget-friendly-ci-templates-2026-05-14-00-52 --type change --strict`.

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/claude/budget-friendly-ci-templates-2026-05-14-00-52 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
