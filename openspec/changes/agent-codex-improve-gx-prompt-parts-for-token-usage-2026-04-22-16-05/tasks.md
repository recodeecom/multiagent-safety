## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`; branch=`agent/codex/improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`; scope=`src/context.js, src/cli/main.js, test/prompt.test.js, README.md, OpenSpec change docs`; action=`add gx prompt part selection, document the new surface, and keep the full prompt modes backward compatible`.
- Copy prompt: Continue `agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05` on branch `agent/codex/improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`. Work inside the existing sandbox, review `openspec/changes/agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`.
- [x] 1.2 Define normative requirements in `specs/gx-prompt-parts/spec.md`.

## 2. Implementation

- [x] 2.1 Add named `gx prompt --part` / `--list-parts` support while keeping the existing full prompt, `--exec`, and `--snippet` outputs intact.
- [x] 2.2 Teach `gx prompt --exec --part ...` to emit only command-capable slices and fail clearly when a selected part has no command-only form.
- [x] 2.3 Update focused prompt docs/tests in `README.md` and `test/prompt.test.js`.

## 3. Verification

- [x] 3.1 Run targeted project verification commands (`node --check src/context.js`, `node --check src/cli/main.js`, `node --test test/prompt.test.js`) — passed on `2026-04-22`.
- [x] 3.2 Run `openspec validate agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05 --type change --strict` — passed on `2026-04-22`.
- [x] 3.3 Run `openspec validate --specs` — passed on `2026-04-22` with `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/codex/improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05 --base main --via-pr --wait-for-merge --cleanup`. The first finish run merged PR #318 but could not prune the worktree because the command was launched from inside that worktree; cleanup then completed from the main checkout with `gx cleanup --base main` and `git remote prune origin`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff. PR #318 (`https://github.com/recodeee/gitguardex/pull/318`) reached `MERGED` at `2026-04-22T14:14:45Z`; merge commit: `3a9d70c`.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch). Verified on `main`: `git worktree list` no longer shows `/home/deadpool/Documents/recodee/gitguardex/.omx/agent-worktrees/agent__codex__improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`, and after `git remote prune origin` there are no remaining local or remote refs for `agent/codex/improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`.

Completion note: The prompt-parts change landed via PR #318 (`https://github.com/recodeee/gitguardex/pull/318`), which reached `MERGED` at `2026-04-22T14:14:45Z` with merge commit `3a9d70c`. The original agent worktree `agent__codex__improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05` was removed from `.omx/agent-worktrees/`, and the stale remote-tracking ref was cleared with `git remote prune origin`.
