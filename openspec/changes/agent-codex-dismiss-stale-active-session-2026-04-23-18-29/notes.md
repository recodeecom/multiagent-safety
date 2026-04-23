# agent-codex-dismiss-stale-active-session-2026-04-23-18-29 (minimal / T1)

Branch: `agent/codex/dismiss-stale-active-session-2026-04-23-18-29`

Add a separate `Dismiss` action for stale or dead Active Agents rows so operators can clear leftover active-session records after usage-limit exits or manual takeovers.
Keep the live `Stop` flow process-oriented for real terminals and pids, while verifying the new dismiss path with the focused extension test suite.

## Handoff

- Handoff: change=`agent-codex-dismiss-stale-active-session-2026-04-23-18-29`; branch=`agent/codex/dismiss-stale-active-session-2026-04-23-18-29`; scope=`Active Agents dismiss action for stalled/dead rows, template parity, manifest bump, focused extension tests`; action=`continue this sandbox, add a separate Dismiss action that removes stale active-session records without reusing Stop, then verify and finish cleanup after the earlier usage-limit takeover`.
- Copy prompt: Continue `agent-codex-dismiss-stale-active-session-2026-04-23-18-29` on branch `agent/codex/dismiss-stale-active-session-2026-04-23-18-29`. Work inside the existing sandbox, review `openspec/changes/agent-codex-dismiss-stale-active-session-2026-04-23-18-29/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/dismiss-stale-active-session-2026-04-23-18-29 --base main --via-pr --wait-for-merge --cleanup`.
- Result: added a separate `Dismiss` action for `stalled`/`dead` Active Agents rows, deleting the matching `.omx/state/active-sessions/*.json` record without reusing the live `Stop` flow; verified with `node --test test/vscode-active-agents-session-state.test.js` (`54/54`).

## Cleanup

- Cleanup result: PR [#393](https://github.com/recodeee/gitguardex/pull/393) is `MERGED` with merge commit `fad45e8daed2be67ec8d88b0cebe1ff5040e73f4`; `gh pr view 393`, `git worktree list`, and `git branch -a` on `main` show the lane is closed and pruned.
- [x] Run: `gx branch finish --branch agent/codex/dismiss-stale-active-session-2026-04-23-18-29 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
