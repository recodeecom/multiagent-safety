# T1 Notes

- Route Claude-triggered Guardex worktrees into `.omc/agent-worktrees` by default while keeping Codex worktrees under `.omx/agent-worktrees`.
- Persist the selected worktree root on each branch so `agent-branch-finish` and prune/recovery flows can resolve the correct sandbox root later.
- Expand setup/workspace discovery, docs, and install regressions so nested-repo scans and VS Code parent-workspace views treat both `.omx` and `.omc` agent-worktree roots as managed paths.
