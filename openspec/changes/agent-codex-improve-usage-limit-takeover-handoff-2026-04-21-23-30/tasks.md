## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a `BLOCKED:` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=`agent-codex-improve-usage-limit-takeover-handoff-2026-04-21-23-30`; branch=`agent/codex/improve-usage-limit-takeover-handoff-2026-04-21-23-30`; scope=`OpenSpec change docs, codex-agent takeover output, change scaffold defaults, install regressions`; action=`emit a copy-paste takeover prompt and keep usage-limit/manual rescue flow inside the existing sandbox`.
- Copy prompt: Continue `agent-codex-improve-usage-limit-takeover-handoff-2026-04-21-23-30` on branch `agent/codex/improve-usage-limit-takeover-handoff-2026-04-21-23-30`. Work inside the existing sandbox, review `openspec/changes/agent-codex-improve-usage-limit-takeover-handoff-2026-04-21-23-30/tasks.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `bash scripts/agent-branch-finish.sh --branch "agent/codex/improve-usage-limit-takeover-handoff-2026-04-21-23-30" --base main --via-pr --wait-for-merge --cleanup`.

## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-improve-usage-limit-takeover-handoff-2026-04-21-23-30`.
- [x] 1.2 Define normative requirements in `specs/improve-usage-limit-takeover-handoff/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes in `scripts/codex-agent.sh` and `scripts/openspec/init-change-workspace.sh`, then mirror the same changes into the managed templates.
- [x] 2.2 Add/update focused regression coverage in `test/install.test.js` for the launcher takeover prompt and the scaffolded handoff/copy prompt defaults.

## 3. Verification

- [x] 3.1 Run targeted project verification commands. Result: `node --test --test-name-pattern "(codex-agent prints a takeover prompt when the sandbox is kept after an incomplete run|OpenSpec change workspace scaffold creates proposal/tasks/spec defaults|OpenSpec change workspace scaffold supports minimal T1 notes mode|critical runtime helper scripts stay in sync with templates)" test/install.test.js test/metadata.test.js` passed `4/4`; `bash -n scripts/codex-agent.sh scripts/openspec/init-change-workspace.sh templates/scripts/codex-agent.sh templates/scripts/openspec/init-change-workspace.sh` passed.
- [x] 3.2 Run `openspec validate agent-codex-improve-usage-limit-takeover-handoff-2026-04-21-23-30 --type change --strict`. Result: passed.
- [x] 3.3 Run `openspec validate --specs`. Result: `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: `bash scripts/agent-branch-finish.sh --branch agent/codex/improve-usage-limit-takeover-handoff-2026-04-21-23-30 --base dev --via-pr --wait-for-merge --cleanup`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).
