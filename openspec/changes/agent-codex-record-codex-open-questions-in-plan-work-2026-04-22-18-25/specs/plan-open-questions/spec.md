# Capability Spec: plan-open-questions

## ADDED Requirements

### Requirement: Plan workspaces capture unresolved questions

Plan workspaces SHALL provide `open-questions.md` for unresolved questions that must survive chat history.

#### Scenario: Agent hits a branching question during planning

- **WHEN** Codex or Claude reaches an unresolved question, branching decision, or blocker during plan-driven work
- **THEN** it records that question in `openspec/plan/<plan-slug>/open-questions.md`
- **AND** the question appears as an unchecked checklist item until resolved

### Requirement: Guardex contract points to the same question log

The repo contract SHALL route unresolved questions into the active plan workspace instead of chat-only notes.

#### Scenario: Multi-agent or plan-driven work needs durable questions

- **WHEN** the repo contract describes collaboration, planning, or handoff rules
- **THEN** it points agents to `openspec/plan/<plan-slug>/open-questions.md`
- **AND** the plan scaffold creates that file by default
