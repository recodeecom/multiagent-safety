## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-ralplan-masterplan-role-prompts-and-owne-2026-04-21-14-48`.
- [x] 1.2 Define normative requirements in `specs/ralplan-masterplan/spec.md`.

## 2. Implementation

- [x] 2.1 Implement scoped behavior changes.
- [x] 2.2 Add/update focused regression coverage.

## 3. Verification

- [x] 3.1 Run targeted project verification commands.
- [x] 3.2 Run `openspec validate agent-codex-ralplan-masterplan-role-prompts-and-owne-2026-04-21-14-48 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

Verification evidence:
- `bash -n scripts/agent-branch-start.sh templates/scripts/agent-branch-start.sh scripts/codex-agent.sh templates/scripts/codex-agent.sh scripts/openspec/init-plan-workspace.sh templates/scripts/openspec/init-plan-workspace.sh`
- `node --test --test-name-pattern "setup agent-branch-start supports optional OpenSpec auto-bootstrap toggles|codex-agent launches codex inside a fresh sandbox worktree and keeps branch/worktree by default|codex-agent restores local branch and falls back to safe worktree start when starter script switches in-place|OpenSpec plan workspace scaffold creates expected role/task structure" test/install.test.js`
- `node --test --test-name-pattern "critical runtime helper scripts stay in sync with templates" test/metadata.test.js`
- `node --test --test-name-pattern "merge branches replays non-conflicting changes onto a dedicated target lane" test/merge-workflow.test.js`
- `openspec validate agent-codex-ralplan-masterplan-role-prompts-and-owne-2026-04-21-14-48 --type change --strict`
- `openspec validate --specs` -> exit 0 with `No items found to validate.`

## 4. Completion

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
