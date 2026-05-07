# planner tasks — submodule-aware gx

> **Role goal**: shape the change so the implementation lane is
> small, testable, and reversible. Own the open-questions list and
> the §V invariant set. You do NOT write code or scripts.

## Scope boundary

In scope:
- `proposal.md`, `tasks.md`, and `specs/gitguardex-submodules/spec.md`
- `open-questions.md`
- choosing the default `GUARDEX_SUBMODULE_MODE` (currently `full-pr`)
- choosing the auto-init default (currently on; opt-out env var)

Out of scope:
- editing scripts under `scripts/agent-*`
- editing `agent-file-locks.py` (that is the executor)
- editing `AGENTS.md` (that is the writer)

## 1. Spec
- [ ] 1.1 Confirm the four ADDED requirements in
       `specs/gitguardex-submodules/spec.md` cover detection,
       lock-keying, atomic gitlink bump, and token preflight; cut
       any that overlap.
- [ ] 1.2 Pin acceptance criteria: each requirement has at least
       one negative scenario (BLOCKED / refusal path).
- [ ] 1.3 Resolve every open question in `open-questions.md` or
       hand it to the architect with a `BLOCKED:` note.

## 2. Tests
- [ ] 2.1 Confirm the test list under `tasks.md §2` exercises every
       scenario in the spec; each scenario maps to at least one
       test case.

## 3. Implementation
- [ ] 3.1 Reject any task scope creep into Rust runtime or frontend
       — this lane is shell + python + a small new helper only.
- [ ] 3.2 Decide whether `gx submodules status` ships in this PR or
       a follow-up. Record the decision in `summary.md`.

## 4. Checkpoints
- [ ] 4.1 Publish a planner checkpoint after spec freeze.
- [ ] 4.2 Publish a second checkpoint after open-questions resolve.

## Handoff fields (paste into Colony when blocked or done)

```
branch=agent/claude/submodule-aware-gx-2026-05-07-18-46
task=planner
blocker=<empty when done>
next=<role to take over>
evidence=openspec/changes/<slug>/proposal.md, specs/gitguardex-submodules/spec.md
```
