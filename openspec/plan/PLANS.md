# Planner Contract

`planner/plan.md` is the durable narrative for the active `openspec/plan/<plan-slug>/` workspace.

## Keep these in sync

- `summary.md` for scope and current status
- `phases.md` for session-sized execution slices
- `checkpoints.md` for timestamped planning handoffs
- `open-questions.md` for unresolved decisions that must survive chat

## Question discipline

Do not bury unresolved planning questions in chat transcripts or one-off handoff notes.
When a question affects scope, sequencing, safety, or implementation shape, add it to `open-questions.md` as an unchecked `- [ ]` item.

Questions should be:

- concrete
- decision-shaped
- easy to verify once answered

When a question is resolved, either check it off with the answer inline or move the final decision into `planner/plan.md` and leave a short resolution note in `open-questions.md`.
