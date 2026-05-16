## 1. Specification

- [x] 1.1 Finalize acceptance criteria for the overlapping-agent merge workflow.
- [x] 1.2 Define normative requirements for integration-branch creation, overlap reporting, and conflict-stop behavior.

## 2. Implementation

- [x] 2.1 Add a managed `agent-branch-merge` script that can create or reuse an integration worktree and merge multiple `agent/*` branches in order.
- [x] 2.2 Add `gx merge` CLI wiring, package metadata, and template/setup propagation for the new workflow.
- [x] 2.3 Keep the protected base branch untouched while merging and print resumable instructions for conflict resolution.

## 3. Verification

- [x] 3.1 Add/update focused regression coverage for clean merges, overlap reporting, and conflict-stop behavior.
- [ ] 3.2 Run `npm test`. BLOCKED: full suite produced early passing output but then stayed silent/hung in this environment; focused `node --test test/merge-workflow.test.js` passed.
- [x] 3.3 Run `node --check bin/multiagent-safety.js`.
- [x] 3.4 Run `openspec validate agent-codex-merge-overlapping-agent-branches-2026-04-21-14-28 --type change --strict`.
- [x] 3.5 Run `openspec validate --specs`.
- [x] 3.6 Run `git diff --check`.

## 4. Completion

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
