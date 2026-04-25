# Notes

- Rename the Active Agents `finished` UI state to `Needs cleanup` for idle dirty worktrees.
- Keep the underlying `activityKind: "finished"` contract unchanged so existing state derivation remains stable.
- Split needs-cleanup sessions out of `Idle / thinking` so the sidebar explains why the worktree is still visible.
- Sync the shipped VS Code extension template with the canonical extension source.
- Bump the Active Agents extension manifest from `0.0.19` to `0.0.20`.
