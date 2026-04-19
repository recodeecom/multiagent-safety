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
- Treat the base branch (`main` or the user's current local base branch) as read-only while the agent branch is active.
- Agent completion defaults to `scripts/codex-agent.sh`, which auto-finishes the branch (auto-commit changed files, push/create PR, attempt merge, and pull the local base branch after merge).
- Auto-finish now waits for required checks/merge and then cleans merged sandbox branch/worktree by default.
- Cleanup for merged `agent/*` branches is mandatory; `agent-branch-finish` must not report completion while local/remote refs or sandbox worktree cleanup is still pending.
- Cleanup automation must be branch-scoped: do not prune other agents' current worktrees during finish; only the source branch sandbox may be auto-removed.
- Other agent worktrees may be pruned only when they are explicitly targeted or have no active local changes.
- If codex-agent auto-finish cannot complete, immediately run `scripts/agent-branch-finish.sh --branch "<agent-branch>" --via-pr --wait-for-merge` and keep the branch open until checks/review pass.
- If merge/rebase conflicts block auto-finish, run a conflict-resolution review pass in that sandbox branch, then rerun `agent-branch-finish.sh --via-pr` until merged.
- Completion is not valid until these are true: commit exists on the agent branch, branch is pushed to `origin`, and PR/merge status is produced by `agent-branch-finish.sh` or `codex-agent`.
- Completion report must include the PR URL and explicit merge state (`OPEN`/`MERGED`); without this, the task is not complete.
- For every new task, if an assigned agent sub-branch/worktree is already open, continue in that sub-branch; otherwise create a fresh one from the current local base snapshot with `scripts/agent-branch-start.sh`.
- Never implement directly on the local/base branch checkout; keep it unchanged and perform all edits in the agent sub-branch/worktree.
- Agent worktree startup must preserve the primary local checkout branch exactly as-is; branch switching is allowed only inside the agent worktree.
- If the change publishes or bumps a version, the same change must also update release notes/changelog entries.

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

4. Required handoff format (every agent, every lane: Claude, Codex, OMX, integrator)

Post the completion handoff in the session transcript using **this exact shape** (copy the template verbatim). It applies identically to Codex-agent runs and Claude-agent runs. A handoff that omits the PR line or the cleanup line is **not** a completion.

````markdown
## Done — <short title>

### Merge state
- PR: <url> (state: **MERGED** | **OPEN**)
- Base branch: <base>
- Commit(s) on <base> after merge: <sha> <subject>

### What landed
- <area 1>: <one-line behavior change>
- <area 2>: <one-line behavior change>
- …

### Verification
- <cmd 1> → <result>
- <cmd 2> → <result>
- <cmd 3> → <result>

### Cleanup
- `git worktree list` shows no `<agent-worktree-path>` entry ✓
- `git branch -a` shows no surviving `<agent-branch>` (local or remote) ✓
- OpenSpec change marked archived (or N/A for T0/T1) ✓

### Risks / follow-ups
- <risk or follow-up>, or "none".
````

Rules for using the template:
- Every bullet in **Merge state**, **Verification**, and **Cleanup** must be present. Drop a line only by replacing it with `N/A — <why>`.
- If the cleanup pipeline didn't run, the handoff must include a `BLOCKED:` line under **Cleanup** explaining the blocker and **STOP**. Do not silently skip cleanup.
- A handoff without a PR URL is not a valid completion — close the gap before posting.

## OpenSpec Multi-Codex Change Management (owner + joined Codexes)

Use this checklist for active OpenSpec changes when one owner Codex may receive help from joined Codexes (including other worktree Codexes).

Joined helper branches that merge into another `agent/*` branch are documentation-exempt assist lanes; they implement assigned scope only and report handoff evidence back to the owner branch artifacts.

Checkpoint discipline (required): update the active change `tasks.md` during work, checkpoint-by-checkpoint, and keep checkbox state synchronized with current progress.

**Definition of Done (applies to every active change):** the change is complete only when every checkbox below is checked AND the agent branch reaches `MERGED` state on `origin` with the PR URL + state recorded in the completion handoff. If verification halts (test failure, conflict, ambiguous result), append a `BLOCKED:` line under the cleanup section explaining the blocker and **STOP** — do not silently skip the cleanup pipeline. Surfacing a blocker is preferred over a half-finished completion.

## 1. Specification

- [ ] 1.1 Finalize proposal scope and acceptance criteria for the active change.
- [ ] 1.2 Define normative requirements in the change spec (`specs/<capability>/spec.md`).

## 2. Implementation

- [ ] 2.1 Implement scoped behavior changes.
- [ ] 2.2 Add/update focused regression coverage.

## 3. Verification

- [ ] 3.1 Run targeted project verification commands.
- [ ] 3.2 Run `openspec validate <change-slug> --type change --strict`.
- [ ] 3.3 Run `openspec validate --specs`.

## 4. Collaboration (only when another Codex joins)

- [ ] 4.1 Owner Codex records each joined Codex (branch/worktree + scope) before accepting work.
- [ ] 4.2 Joined Codexes may review, propose solution tasks, and implement only within assigned scope.
- [ ] 4.3 Owner Codex must acknowledge joined outputs (accept/revise/reject) before moving to cleanup.
- [ ] 4.4 If no Codex joined, mark this section `N/A` and continue.

## 5. Cleanup (mandatory; run before claiming completion)

**This section is not optional. Codex and Claude lanes skip cleanup most often when the agent exits mid-run (crash, budget, kill). If you are the next agent to touch the repo and you see a stalled `agent/*` worktree, you own its cleanup — do not wait for the original author.**

- [ ] 5.1 Run the cleanup pipeline: `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base dev --via-pr --wait-for-merge --cleanup`. This handles commit → push → PR create → merge wait → worktree prune in one invocation.
- [ ] 5.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 5.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
- [ ] 5.4 If the finish script reports "cleanup is still incomplete" because the shell is still inside the sandbox dir, `cd` to the repo root and run `git worktree remove -f <sandbox-path>`. Re-verify 5.3 after.
- [ ] 5.5 Codex-agent-specific: if `codex-agent.sh` was killed before it could auto-finish, recover via `bash scripts/agent-autofinish-watch.sh --once --auto-merge` (or `--daemon` for continuous sweep). Never declare the task done while an `agent/*` worktree is still dirty with unmerged commits.

For change specs that need explicit baseline requirement wording, use this pattern:

## ADDED Requirements

### Requirement: <change-slug> behavior
The system SHALL enforce <change-slug> behavior as defined by this change.

#### Scenario: Baseline acceptance
- **WHEN** <change-slug> behavior is exercised
- **THEN** the expected outcome is produced
- **AND** regressions are covered by tests.

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
