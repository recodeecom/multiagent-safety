# Tasks

Handoff: change=`agent-codex-patch-vscode-active-agents-empty-list-2026-04-23-11-32`; branch=`agent/codex/patch-vscode-active-agents-empty-list-2026-04-23-11-32`; scope=`vscode/guardex-active-agents/session-schema.js`, `templates/vscode/guardex-active-agents/session-schema.js`, `test/vscode-active-agents-session-state.test.js`; action=`patch Active Agents discovery so plain managed worktrees show in the VS Code SCM view, verify, then finish via PR merge cleanup`.

## 1. Spec

- [x] 1.1 Capture the empty-list fallback failure and acceptance criteria.

## 2. Tests

- [x] 2.1 Add session-schema regression coverage for plain managed worktrees with no launcher JSON and no `AGENT.lock`.
- [x] 2.2 Add extension-view regression coverage proving workspace fallback renders those worktrees instead of the empty state.

## 3. Implementation

- [x] 3.1 Add managed-worktree session synthesis while keeping `AGENT.lock` telemetry preferred.
- [x] 3.2 Mirror the session schema change into the install template.
- [x] 3.3 Bump live/template Active Agents extension manifests from `0.0.7` to `0.0.8` so local VS Code auto-update can supersede the installed build.

## 4. Verification

- [x] 4.1 Run focused Active Agents tests. Result: `node --test test/vscode-active-agents-session-state.test.js` passed, 39/39; `node --test test/metadata.test.js` passed, 18/18.
- [x] 4.2 Validate OpenSpec specs. Result: `openspec validate agent-codex-patch-vscode-active-agents-empty-list-2026-04-23-11-32 --strict` passed; `openspec validate --specs` returned no main-spec items.

## 5. Cleanup

- [x] 5.1 Commit, push, open PR, wait for `MERGED`, and prune the sandbox with `gx branch finish --branch "agent/codex/patch-vscode-active-agents-empty-list-2026-04-23-11-32" --base main --via-pr --wait-for-merge --cleanup`. Result: PR #356 merged at `561c0621027e545bfdf18cc6f461dfda6b515510`; follow-up `gx cleanup --base main` pruned the detached source worktree.
- [x] 5.2 Record PR URL and final `MERGED` cleanup evidence here. Result: https://github.com/recodeee/gitguardex/pull/356 state=`MERGED`; final `git worktree list` showed only the primary `/home/deadpool/Documents/recodee/gitguardex` worktree after cleanup.
