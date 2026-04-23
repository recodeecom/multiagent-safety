## Definition of Done

This change is complete only when all of the following are true:

- Every checkbox below is checked.
- Focused extension/package tests pass.
- Cleanup records the final PR URL plus `MERGED` evidence, or a `BLOCKED:` line explains why finish could not complete.

Handoff: 2026-04-23 codex owns branch `agent/codex/add-openspec-and-provider-icons-2026-04-23-14-02`, the Active Agents extension bundle, mirrored template files, focused tests, and this OpenSpec change to ship Explorer file icons plus provider-aware Active Agents rows.

## 1. Specification

- [x] 1.1 Finalize proposal scope for Explorer file icons plus provider-aware Active Agents rows.
- [x] 1.2 Define normative requirements in `specs/vscode-active-agents-provider-icons/spec.md`.

## 2. Implementation

- [x] 2.1 Add bundled file icon theme assets and manifest wiring for OpenSpec, agent, and hook surfaces.
- [x] 2.2 Add provider/snapshot-aware Active Agents row labels/badges and branch-icon worktree groups without overriding higher-priority warning/idle decorations.
- [x] 2.3 Keep live/template extension sources, docs, and packaging metadata aligned.

## 3. Verification

- [x] 3.1 Run focused extension/install/package coverage. Result: `node --test test/vscode-active-agents-session-state.test.js test/metadata.test.js test/setup.test.js` passed `102/102`.
- [x] 3.2 Run `openspec validate agent-codex-add-openspec-and-provider-icons-2026-04-23-14-02 --type change --strict`. Result: passed.
- [x] 3.3 Run `openspec validate --specs`. Result: `No items found to validate.`

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run `gx branch finish --branch "agent/codex/add-openspec-and-provider-icons-2026-04-23-14-02" --base main --via-pr --wait-for-merge --cleanup`. Result: PR #368 merged, then finish exited `1` during local source-worktree deletion because the `/tmp` source worktree was still active.
- [x] 4.2 Record the PR URL and final `MERGED` state in the completion handoff. Result: `gh pr view agent/codex/add-openspec-and-provider-icons-2026-04-23-14-02 --json url,state,mergedAt,mergeCommit` returned `https://github.com/recodeee/gitguardex/pull/368`, `MERGED`, `2026-04-23T11:45:28Z`, merge commit `06a260e1ef7f543f6b773fb7f944ed85b24dc2ee`.
- [x] 4.3 Confirm the sandbox worktree and branch refs are gone after cleanup. Result: removed `/tmp/gitguardex-agent__codex__add-openspec-and-provider-icons-2026-04-23-14-02`, deleted local branch `agent/codex/add-openspec-and-provider-icons-2026-04-23-14-02`, ran `git fetch --prune origin` and `git worktree prune`; `git worktree list --porcelain`, `git branch --list`, and `git branch -r --list` no longer show that lane.

BLOCKED: none.
