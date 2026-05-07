# writer tasks — submodule-aware gx

> **Role goal**: keep durable docs in sync with the change. Update
> AGENTS.md, README, and OpenSpec context docs. Do not edit
> CHANGELOG.md.

## Scope boundary

In scope:
- `AGENTS.md` (Multi-Agent Execution Contract → new "Submodules"
  subsection)
- `README.md` (one-paragraph note in the "How it works" or "Branch
  lifecycle" section)
- `openspec/specs/gitguardex-submodules/context.md` (new) when this
  change archives — narrative purpose, rationale, examples.
- this plan workspace's `summary.md` and `checkpoints.md` updates.

Out of scope:
- `CHANGELOG.md` (release process owns it)
- `docs/` (per AGENTS.md, behavior contracts live in OpenSpec)
- frontend marketing pages

## 1. Spec
- [ ] 1.1 Confirm doc updates do not duplicate spec normative
       text. Specs use MUST/SHALL; docs explain *why*.

## 2. Tests
- [ ] 2.1 N/A — docs ride the executor's verification.

## 3. Implementation
- [ ] 3.1 Append a `### Submodules` subsection under
       `AGENTS.md > Multi-Agent Execution Contract`, summarizing
       detection, lock-keying, modes, atomic bump, preflight.
- [ ] 3.2 Add a 4-6 line note to `README.md` describing how `gx`
       handles nested git repos when present, with a pointer to
       the spec.
- [ ] 3.3 On archive, write
       `openspec/specs/gitguardex-submodules/context.md` with
       purpose, decisions, constraints, failure modes, and at
       least one concrete example (commands + expected output).

## 4. Checkpoints
- [ ] 4.1 Publish writer checkpoint after AGENTS.md + README land.
- [ ] 4.2 Publish writer checkpoint after archive context.md lands.

## Handoff fields

```
branch=agent/claude/submodule-aware-gx-2026-05-07-18-46
task=writer
blocker=<empty when done>
next=verifier
evidence=git diff --stat AGENTS.md README.md
```
