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
- Agent completion must use `scripts/agent-branch-finish.sh` (direct merge to base when allowed; auto PR fallback for protected bases, then cleanup after merge).

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
