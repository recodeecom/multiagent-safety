# OpenSpec Plan Workspaces

Use `openspec/plan/<plan-slug>/` for durable planning artifacts that must survive chat history.

## Required shared files

- `summary.md`
- `checkpoints.md`
- `phases.md`
- `open-questions.md`
- `coordinator-prompt.md`
- `kickoff-prompts.md` when wave splitting is needed

## Open questions rule

When Codex or Claude hits an unresolved question, branching decision, or blocker that should survive chat, record it in `openspec/plan/<plan-slug>/open-questions.md` as an unchecked `- [ ]` item.

Example checklist:

- [ ] Should finish override be allowed when joined sessions are active, and if yes what exact flag/guard text should be used?
- [ ] Do we want join-mode sessions to be persisted only by PID or by a stable explicit session id generated at join time?
- [ ] Should lock registry entries carry joined session identity in this first iteration, or deferred to a follow-up change?

Avoid vague notes like `- [ ] Figure out join mode somehow`.

Close questions in place with the answer, linked evidence, or a checked item once the decision is made.

## Minimum role hygiene

- Keep role `tasks.md` checklists current.
- Record joined-agent handoffs in the relevant role workspace.
- Push unresolved plan questions into `open-questions.md` instead of chat-only notes.
