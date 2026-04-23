## Why

- The raw Active Agents tree still surfaces machine worktree folder names and full `agent/...` refs, which slows scan time when many sandboxes are open.
- Operators need dense `3 files`-style summaries and branch labels that read like task rows, not filesystem internals.

## What Changes

- Prefer task-first labels for raw worktree groups when the worktree maps to a single active session.
- Compact raw branch rows from full `agent/<owner>/<task>` refs to a shorter owner/task label while keeping the full ref in tooltips.
- Normalize raw session summaries to `Working · 3 files · ...` wording and mirror the update into the template extension source.
- Bump the live/template Active Agents manifest versions for the shipped UI tweak.

## Impact

- Scope stays inside the VS Code Active Agents extension tree presentation.
- Full worktree paths and full branch refs remain available in tooltips and commands.
- Focused regression coverage stays in `test/vscode-active-agents-session-state.test.js`.
