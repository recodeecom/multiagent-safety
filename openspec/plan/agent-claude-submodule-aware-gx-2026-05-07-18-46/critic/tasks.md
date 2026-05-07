# critic tasks — submodule-aware gx

> **Role goal**: stress-test the design and the executor's diff.
> Find the case the spec did not cover. Reject merge until every
> §V invariant has a test that would fail without the change.

## Scope boundary

In scope:
- review of `proposal.md`, spec deltas, executor diff, tests
- adding negative scenarios that the planner missed
- requesting changes via comments on the executor's commits

Out of scope:
- editing scripts or specs directly (suggest, do not patch)
- ownership of merge — that is the verifier

## 1. Spec
- [ ] 1.1 Re-read the spec and list every invariant the executor
       could violate without breaking a test. Add tests until
       that list is empty.
- [ ] 1.2 Confirm the spec uses MUST/SHALL language consistently;
       flag any soft-language drift (`should`, `tries to`).

## 2. Tests
- [ ] 2.1 Verify the partial-failure scenario (one submodule PR
       merges, one fails) is exercised end-to-end, not just at the
       unit level.
- [ ] 2.2 Verify the legacy lock entry migration is tested with a
       real fixture file, not a generated one.
- [ ] 2.3 Add a test for the cross-org case: two submodules in
       different orgs, token has push on one but not the other.

## 3. Implementation
- [ ] 3.1 Review the executor's diff for: unclaimed file edits,
       `--no-verify` usage, force-push attempts, missing
       `submodule_root` in lock writes, missing rollback when
       atomic bump aborts.
- [ ] 3.2 Reject any change that bumps a parent gitlink before
       confirming child PR `MERGED`. This is the load-bearing
       invariant.

## 4. Checkpoints
- [ ] 4.1 Publish critic checkpoint with `accepted` or `changes
       requested` and the explicit blocker list.

## Handoff fields

```
branch=agent/claude/submodule-aware-gx-2026-05-07-18-46
task=critic
blocker=<list missing tests / unsafe diffs>
next=executor (revise) | verifier (advance)
evidence=PR review URL, list of missing scenarios
```
