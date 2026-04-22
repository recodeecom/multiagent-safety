## Definition of Done

This change is complete only when all of the following are true:

- Every checkbox below is checked.
- The agent branch reaches `MERGED` state on `origin` and the PR URL + state are recorded in the completion handoff.
- If any step blocks, append a `BLOCKED:` line under section 4 and stop.

## 1. Specification

- [x] 1.1 Capture the lock badge, foreign-lock warning, watcher refresh, and lock-file filtering behavior in branch-local OpenSpec artifacts.

## 2. Implementation

- [x] 2.1 Cache `.omx/state/agent-file-locks.json` per repo inside the Active Agents provider.
- [x] 2.2 Append `🔒 N` to each session row from the owning branch's lock count.
- [x] 2.3 Warn on repo-root change rows when the lock owner branch differs from the repo worktree branch.
- [x] 2.4 Refresh cached lock state from lock-file watcher events instead of per-`getChildren()` parsing.
- [x] 2.5 Exclude `.omx/state/agent-file-locks.json` from repo-root `CHANGES`.
- [x] 2.6 Mirror the runtime changes into `templates/vscode/guardex-active-agents/*`.
- [x] 2.7 Add focused regression coverage for lock badges, foreign-lock warnings, and watcher-driven re-reads.

## 3. Verification

- [x] 3.1 Run `node --test test/vscode-active-agents-session-state.test.js`.
- [x] 3.2 Run `openspec validate agent-codex-vscode-tree-lock-decorations-clean-2026-04-22-11-09 --type change --strict`.

## 4. Cleanup

- [ ] 4.1 Run `bash scripts/agent-branch-finish.sh --branch agent/codex/vscode-tree-lock-decorations-clean-2026-04-22-11-09 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone and the branch refs are cleaned up.
