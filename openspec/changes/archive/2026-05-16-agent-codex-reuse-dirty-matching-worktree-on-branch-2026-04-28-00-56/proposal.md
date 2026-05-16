## Why

- A follow-up prompt can refer to an unfinished task whose dirty worktree was left behind by a blocked commit or interrupted session.
- Today `gx branch start --reuse-existing` only reuses the current agent worktree. From the protected checkout it can miss dirty managed worktrees that are visible in VS Code but absent from live notepad/handoff state, then create a fresh branch and duplicate copied changes.

## What Changes

- Teach branch start to scan managed `.omx/agent-worktrees` and `.omc/agent-worktrees` for dirty same-agent branches whose task tokens match the requested task.
- Reuse the single best matching dirty worktree before creating a fresh branch.
- Keep ambiguous matches conservative: create a fresh branch only when there is no unique matching dirty worktree.
- Cover the behavior in branch-start regression tests and keep the install template in sync.

## Impact

- Affects `gx branch start` and template-provisioned `scripts/agent-branch-start.sh`.
- Reduces duplicate worktree creation for continuation/takeover prompts.
- Matching stays limited to same-agent dirty managed worktrees to avoid stealing unrelated clean or completed lanes.
