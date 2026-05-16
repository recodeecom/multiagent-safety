# agent-codex-scm-active-agent-signals-2026-04-22-15-54 (minimal / T1)

Branch: `agent/codex/scm-active-agent-signals-2026-04-22-15-54`

Make the existing VS Code `Active Agents` Source Control surface harder to miss during commit flow. Keep the grouped tree in the SCM container, but add stronger current-agent cues in the commit input, a status-bar shortcut, and file decorations for Guardex lock ownership on changed files.

Scope:
- Extend the Active Agents extension manifest with a focus command and status-bar-friendly wording.
- Update `templates/vscode/guardex-active-agents/extension.js` to show selected-session branch metadata in the custom SCM commit input and status bar.
- Add file decorations for real file URIs so Guardex lock ownership is visible directly on changed files.
- Extend the active-agents regression suite for the new SCM input, status bar, and lock-decoration behavior.
- Update the extension README so the SCM affordances match the shipped experience.

Verification:
- `node --test test/vscode-active-agents-session-state.test.js`

## Handoff

- Handoff: change=`agent-codex-scm-active-agent-signals-2026-04-22-15-54`; branch=`agent/codex/scm-active-agent-signals-2026-04-22-15-54`; scope=`templates/vscode/guardex-active-agents/*, test/vscode-active-agents-session-state.test.js, openspec/changes/agent-codex-scm-active-agent-signals-2026-04-22-15-54/*`; action=`add SCM-visible agent cues, verify with targeted extension tests, then finish this sandbox via PR merge + cleanup`.
- Copy prompt: Continue `agent-codex-scm-active-agent-signals-2026-04-22-15-54` on branch `agent/codex/scm-active-agent-signals-2026-04-22-15-54`. Work inside the existing sandbox, review `openspec/changes/agent-codex-scm-active-agent-signals-2026-04-22-15-54/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/scm-active-agent-signals-2026-04-22-15-54 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [x] Run: `gx branch finish --branch agent/codex/scm-active-agent-signals-2026-04-22-15-54 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
