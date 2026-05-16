## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-claude-harden-claude-pivot-2026-04-27-09-28`; branch=`agent/claude/harden-claude-pivot-2026-04-27-09-28`; scope=`Hook whitelist + gx pivot / gx ship`; action=`continue this sandbox or finish cleanup after a usage-limit/manual takeover`.
- Copy prompt: Continue `agent-claude-harden-claude-pivot-2026-04-27-09-28` on branch `agent/claude/harden-claude-pivot-2026-04-27-09-28`. Work inside the existing sandbox, review `openspec/changes/agent-claude-harden-claude-pivot-2026-04-27-09-28/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/claude/harden-claude-pivot-2026-04-27-09-28 --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-harden-claude-pivot-2026-04-27-09-28`.
- [x] 1.2 Define normative requirements in `specs/general-behavior/spec.md`.

## 2. Implementation

- [x] 2.1 Widen `SHELL_ALLOWED_SEGMENTS` in `.claude/hooks/skill_guard.py` and `.codex/hooks/skill_guard.py` to allow safe sync ops, agent-only push, full `gh pr` surface, `gx <subcommand>`, and `agent-branch-finish.sh` / `agent-pivot.sh`.
- [x] 2.2 Update both BLOCKED messages to point at `gx pivot "<task>" "<agent>"` as the single-tool-call escape and clarify the override env must be exported in the harness, not as a command prefix.
- [x] 2.3 Add `gx pivot` CLI command in `src/cli/main.js` (forwards to `branchStart`; emits `WORKTREE_PATH=` / `BRANCH=` / `NEXT_STEP=` trailer; short-circuits on existing `agent/*` branches).
- [x] 2.4 Add `gx ship` CLI command (alias for `gx finish --via-pr --wait-for-merge --cleanup`, injects missing flags).
- [x] 2.5 Register `pivot` + `ship` in `SUGGESTIBLE_COMMANDS` and the `Branch workflow` help group in `src/context.js`.

## 3. Verification

- [x] 3.1 Run `node --test test/pivot.test.js` (2 new tests: protected-branch pivot + agent-branch short-circuit).
- [x] 3.2 Run inline regex self-test (19/19 cases pass for whitelist allow/deny).
- [x] 3.3 Run `npm test` baseline (without `CLAUDECODE` env): 277 pass / 2 pre-existing failures unrelated to this change (`agent-branch-finish auto-commits parent gitlink after nested repo finish`, `setup refreshes initialized protected main through a sandbox and prunes it` — caused by submodule timing and system git's lack of `worktree --orphan`).
- [x] 3.4 Run `openspec validate agent-claude-harden-claude-pivot-2026-04-27-09-28 --type change --strict`.
- [x] 3.5 Run `openspec validate --specs`.

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run the cleanup pipeline: `gx branch finish --branch agent/claude/harden-claude-pivot-2026-04-27-09-28 --base main --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
