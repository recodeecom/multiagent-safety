# agent-codex-fix-active-agents-view-container-id-2026-04-25-15-48 (minimal / T1)

Branch: `agent/codex/fix-active-agents-view-container-id-2026-04-25-15-48`

Fix the VS Code Active Agents view container registration. VS Code rejects contributed activity bar container IDs containing dots, so the companion extension must use an alphanumeric/underscore/hyphen-only container ID while preserving the existing `gitguardex.activeAgents` view ID and commands.

Scope:
- Update live and template Active Agents manifests to use `gitguardex-active-agents-container`.
- Update the focus command target to `workbench.view.extension.gitguardex-active-agents-container`.
- Add regression coverage for the container ID character constraint and focus command target.

Verification:
- `node --test test/vscode-active-agents-session-state.test.js`
- Manifest parity check covered by the focused test.

## Handoff

- Handoff: change=`agent-codex-fix-active-agents-view-container-id-2026-04-25-15-48`; branch=`agent/codex/fix-active-agents-view-container-id-2026-04-25-15-48`; scope=`vscode/guardex-active-agents/package.json, templates/vscode/guardex-active-agents/package.json, paired extension.js focus command, test/vscode-active-agents-session-state.test.js`; action=`replace invalid dotted view-container id, verify focused extension test, then finish via PR merge + cleanup`.
- Copy prompt: Continue `agent-codex-fix-active-agents-view-container-id-2026-04-25-15-48` on branch `agent/codex/fix-active-agents-view-container-id-2026-04-25-15-48`. Work inside the existing sandbox, keep live/template VS Code extension files in sync, and when verification is clean run `gx branch finish --branch agent/codex/fix-active-agents-view-container-id-2026-04-25-15-48 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [x] Run: `gx branch finish --branch agent/codex/fix-active-agents-view-container-id-2026-04-25-15-48 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
