# agent-codex-self-heal-repo-scan-ignores-2026-04-23-12-12 (minimal / T1)

Branch: `agent/codex/self-heal-repo-scan-ignores-2026-04-23-12-12`

Older repos can keep stale `.vscode/settings.json` values for `git.repositoryScanIgnoredFolders` until operators rerun `gx setup` or `gx doctor`. The shipped `Active Agents` extension should self-heal that workspace setting on activation and whenever workspace folders change so nested `.omx/.omc` helper worktrees stop leaking back into the default VS Code repo scan.

Scope:
- Update `vscode/guardex-active-agents/extension.js` to merge the managed repo-scan ignore folders into live workspace Git settings during activation and workspace-folder changes, while tolerating read-only settings.
- Mirror the same change into `templates/vscode/guardex-active-agents/extension.js` so shipped and template sources stay in sync.
- Add one focused regression in `test/vscode-active-agents-session-state.test.js` that proves activation/workspace-folder self-healing preserves existing user entries and avoids duplicate managed paths.

Verification:
- `node --test test/vscode-active-agents-session-state.test.js test/metadata.test.js`
- `openspec validate --specs`

## Handoff

- Handoff: change=`agent-codex-self-heal-repo-scan-ignores-2026-04-23-12-12`; branch=`agent/codex/self-heal-repo-scan-ignores-2026-04-23-12-12`; scope=`vscode/guardex-active-agents/extension.js, templates/vscode/guardex-active-agents/extension.js, test/vscode-active-agents-session-state.test.js, openspec/changes/agent-codex-self-heal-repo-scan-ignores-2026-04-23-12-12/notes.md`; action=`self-heal managed repo-scan ignores from the Active Agents extension, verify with focused node tests plus openspec validation, then finish via PR merge + cleanup`.

## Cleanup

- [x] Run: `gx branch finish --branch agent/codex/self-heal-repo-scan-ignores-2026-04-23-12-12 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
