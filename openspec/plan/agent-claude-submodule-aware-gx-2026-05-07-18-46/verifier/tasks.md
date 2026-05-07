# verifier tasks — submodule-aware gx

> **Role goal**: prove the change works against this exact repo
> before archive. No "looks good" without command-output evidence.

## Scope boundary

In scope:
- running every verification gate defined in `tasks.md §4`
- recording exact commands and output (or summarized last lines)
- approving archive only when every §V invariant has empirical
  evidence of working

Out of scope:
- writing fixes (executor) or specs (planner)

## 1. Spec
- [ ] 1.1 Confirm `openspec validate --specs` passes against the
       worktree's OpenSpec layout.

## 2. Tests
- [ ] 2.1 Run `npm test`; record pass count and any pre-existing
       failures separately from this lane's failures.
- [ ] 2.2 Run the new submodule tests in isolation:
       `node --test test/agent-submodules-detect.test.js`,
       `node --test test/agent-submodules-finish.test.js`,
       `node --test test/agent-submodules-preflight.test.js`,
       `python3 -m unittest test/agent-submodules-locks.test.py`
       (or pytest if available). Record full output.
- [ ] 2.3 Live walkthrough on this very repo:
       1. `gx submodules status` → confirm detection of the three
          dirty `m` paths from `git status`.
       2. `gx submodules preflight` → confirm cross-org token
          probe completes for `NagyVikt/*` and `recodeee/*`.
       3. Pick the smallest dirty submodule, edit one file inside
          its tree, run `gx branch finish ... --via-pr
          --wait-for-merge` and confirm:
          - child PR opens in the submodule's repo
          - parent's last commit subject is
            `chore(submodules): bump gitlinks for <slug>`
          - parent commit's diff updates exactly one gitlink.

## 3. Implementation
- [ ] 3.1 N/A — verifier does not implement.

## 4. Checkpoints
- [ ] 4.1 Publish verifier checkpoint with explicit
       `verified` / `BLOCKED` outcome and the commands run.
- [ ] 4.2 Approve archive (`/opsx:archive`) only after the live
       walkthrough succeeds end-to-end.

## Handoff fields

```
branch=agent/claude/submodule-aware-gx-2026-05-07-18-46
task=verifier
blocker=<failing gate / missing evidence>
next=archive
evidence=command outputs in summary.md > Verification Snapshot
```
