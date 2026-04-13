<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->
YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.
DO NOT STOP TO ASK "SHOULD I PROCEED?" — PROCEED. DO NOT WAIT FOR CONFIRMATION ON OBVIOUS NEXT STEPS.
IF BLOCKED, TRY AN ALTERNATIVE APPROACH. ONLY ASK WHEN TRULY AMBIGUOUS OR DESTRUCTIVE.
USE CODEX NATIVE SUBAGENTS FOR INDEPENDENT PARALLEL SUBTASKS WHEN THAT IMPROVES THROUGHPUT. THIS IS COMPLEMENTARY TO OMX TEAM MODE.
<!-- END AUTONOMY DIRECTIVE -->

# oh-my-codex - Intelligent Multi-Agent Orchestration

This AGENTS.md is the top-level operating contract for this repository.

## Operating principles

- Solve the task directly when possible.
- Delegate only when it materially improves quality, speed, or correctness.
- Keep progress short, concrete, and useful.
- Prefer evidence over assumption; verify before claiming completion.
- Use the lightest path that preserves quality.
- Check official docs before implementing with unfamiliar SDKs/APIs.

## Working agreements

- For cleanup/refactor/deslop work: write a cleanup plan first.
- Lock behavior with regression tests before cleanup edits when needed.
- Treat `main` and any currently checked-out base branch as read-only workspaces.
- Every new session must start by creating an isolated agent branch/worktree via `scripts/agent-branch-start.sh` before making edits.
- If edits are found on `main`/base by mistake, immediately move them to a dedicated agent branch/worktree before continuing.
- In-place agent branching is disallowed; keep the visible local/base checkout unchanged and do all edits in dedicated agent worktrees.
- Prefer deletion over addition.
- Reuse existing patterns before introducing new abstractions.
- No new dependencies without explicit request.
- When publishing or bumping a version, update release notes in the same change (`README.md` release notes section and the release body when tagging).
- Keep diffs small, reviewable, and reversible.
- Run lint/typecheck/tests/static analysis after changes.
- Final reports must include: changed files, simplifications made, and remaining risks.

## Delegation rules

Default posture: work directly.

Mode guidance:
- Use deep interview for unclear requirements.
- Use ralplan for plan/tradeoff/test-shape consensus.
- Use team only for multi-lane coordinated execution.
- Use ralph only for persistent single-owner completion loops.
- Otherwise execute directly in solo mode.

## Verification

- Verify before claiming completion.
- Run dependent tasks sequentially.
- If verification fails, continue iterating instead of stopping early.
- Before concluding, confirm: no pending work, tests pass, no known errors, and evidence collected.

## Lore commit protocol

Commit messages should capture decision records using git trailers.

Recommended trailers:
- Constraint:
- Rejected:
- Confidence:
- Scope-risk:
- Reversibility:
- Directive:
- Tested:
- Not-tested:
- Related:

## Cancellation

Use cancel mode/workflow only when work is complete, user says stop, or a hard blocker prevents meaningful progress.

## State management

OMX runtime state typically lives under `.omx/`:
- `.omx/state/`
- `.omx/notepad.md`
- `.omx/project-memory.json`
- `.omx/plans/`
- `.omx/logs/`

<!-- multiagent-safety:START -->
## Multi-Agent Execution Contract (multiagent-safety)

0. Session plan comment + read gate (required)

- Before editing, each agent must post a short session comment/handoff note that includes:
  - plan/change name (or checkpoint id),
  - owned files/scope,
  - intended action.
- Before deleting/replacing code, each agent must read the latest session comments/handoffs first and confirm the target code is in their owned scope.
- If ownership is unclear or overlaps, stop that edit, post a blocker comment, and let the leader/integrator reassign scope.
- For git isolation, each agent must start on a dedicated branch via `scripts/agent-branch-start.sh "<task-or-plan>" "<agent-name>"`.
- In-place branch mode is disallowed: never switch the active local/base checkout to an agent branch.
- Do not implement changes directly on `main` or other base branches; all edits must happen on dedicated agent branches/worktrees.
- If the current local branch already contains accidental edits, move them to an agent branch/worktree first, then continue implementation.
- Treat the base branch (`main` or the user's current local base branch) as read-only while the agent branch is active.
- Agent completion defaults to `scripts/codex-agent.sh`, which auto-finishes the branch (auto-commit changed files, push/create PR, attempt merge, and pull the local base branch after merge).
- Auto-finish now waits for required checks/merge and then cleans merged sandbox branch/worktree by default.
- Use `--no-cleanup` only when you explicitly need to keep a merged sandbox for audit/debug follow-up.
- If codex-agent auto-finish cannot complete, immediately run `scripts/agent-branch-finish.sh --branch "<agent-branch>" --via-pr --wait-for-merge` and keep the branch open until checks/review pass.
- If merge/rebase conflicts block auto-finish, run a conflict-resolution review pass in that sandbox branch, then rerun `agent-branch-finish.sh --via-pr` until merged.
- Completion is not valid until these are true: commit exists on the agent branch, branch is pushed to `origin`, and PR/merge status is produced by `agent-branch-finish.sh` or `codex-agent`.
- Per-message loop is mandatory: for every new user message/task, start a fresh agent branch/worktree, claim ownership locks, implement and verify, finish via PR/merge cleanup, then repeat for the next message/task.

1. Explicit ownership before edits

- Assign each agent clear file/module ownership.
- Do not edit files outside your assigned scope unless the leader reassigns ownership.

2. Preserve parallel safety

- Assume other agents are editing nearby code concurrently.
- Never revert unrelated changes authored by others.
- If another change conflicts with your approach, adapt and report the conflict in handoff.

3. Verify before completion

- Run required local checks for the area you changed.
- Do not mark work complete without command output evidence.

4. Required handoff format (every agent)

- Files changed
- Behavior touched
- Verification commands + results
- Risks / follow-ups

## OpenSpec Plan Workspace (recommended)

When work needs a durable planning phase, scaffold a plan workspace before implementation:

```bash
bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"
```

Expected shape:

```text
openspec/plan/<plan-slug>/
  summary.md
  checkpoints.md
  planner/plan.md
  planner/tasks.md
  architect/tasks.md
  critic/tasks.md
  executor/tasks.md
  writer/tasks.md
  verifier/tasks.md
```
<!-- multiagent-safety:END -->
