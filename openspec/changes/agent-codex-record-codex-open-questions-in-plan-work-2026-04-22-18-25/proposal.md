# Proposal: record codex open questions in plan workspace

## Why

- The repo contract keeps planning artifacts in-repo, but unresolved questions can still disappear into chat-only notes.
- The user wants a durable `plans/open-questions` rule that behaves the same way across repos.
- The current plan scaffold does not create an `open-questions.md` file, so the contract has no concrete landing zone.

## What Changes

- [ ] Add an `open-questions.md` requirement to the live repo contract and reusable multiagent template.
- [ ] Add committed `openspec/plan` guidance describing how open questions should be recorded.
- [ ] Update the plan-workspace scaffold to create `open-questions.md` and point roles/coordinators at it.
- [ ] Seed this task's plan workspace with the exact three joined-session questions from the user.

## Impact

- Scope: AGENTS contract, reusable template, OpenSpec plan docs, plan scaffold.
- Risks: Low; wording drift between live and templated docs if one surface is missed.
- Dependencies: `scripts/openspec/init-plan-workspace.sh` and `templates/scripts/openspec/init-plan-workspace.sh` must stay in sync.
