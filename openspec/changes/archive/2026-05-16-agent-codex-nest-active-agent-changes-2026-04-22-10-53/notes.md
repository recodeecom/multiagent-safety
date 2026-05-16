# T1 Notes

- Handoff: change=`agent-codex-nest-active-agent-changes-2026-04-22-10-53`; scope=`vscode/guardex-active-agents/{extension.js,session-schema.js}`; action=`nest repo changes under the owning active session row when the path belongs to that session worktree, and keep only unmatched paths in a Repo root residual group`.
- Add `changedPaths` to normalized active-session records so the extension reuses the per-worktree change set already derived from each session's worktree status.
- Rebuild the CHANGES tree grouping so active-session worktree ownership is resolved once and rendered as session subtrees with the existing folder/change item components.
- Preserve the existing file/folder rendering for all leaf nodes and leave only paths that do not belong to any active worktree inside a residual `Repo root` group.
- Verification widened scope: runtime helper parity was already broken on this branch baseline, so `scripts/{agent-branch-start.sh,agent-branch-finish.sh,codex-agent.sh}` are also being resynced to their template behavior to clear repo-wide verification.
- Verification follow-up: `test/merge-workflow.test.js` still expected a repo-local merge shim, but the install surface now keeps workflow shims CLI-owned by default; align that stale assertion with the current zero-copy setup policy so full-suite verification matches the rest of the install tests.
- Replace the Active Agents polling loop with file watchers for `**/.omx/state/active-sessions/*.json`, `**/.omx/state/agent-file-locks.json`, and each live session worktree index so the SCM companion refreshes only when session or dirty-state inputs change.
- Debounce watcher-driven refresh to a trailing 250ms timer and keep a session-keyed watcher map so per-session index watchers are created and disposed as active sessions appear and vanish.
