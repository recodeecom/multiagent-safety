## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-improve-setup-new-repo-docker-loader-2026-04-21-11-41`.
- [x] 1.2 Define normative requirements in `specs/setup-fresh-repo-experience/spec.md`.

## 2. Implementation

- [x] 2.1 Patch setup/scan so fresh repos show the unborn branch name and clearer next-step onboarding hints.
- [x] 2.2 Add the managed Docker loader script and wire it into the bootstrap template + package scripts.
- [x] 2.3 Update README/docs for the new Docker helper and fresh setup guidance.
- [x] 2.4 Add regression coverage for the new repo onboarding and Docker loader behavior.

## 3. Verification

- [x] 3.1 Run `node --check bin/multiagent-safety.js` plus an end-to-end temp-repo bootstrap repro covering the fresh setup hints and Docker loader dispatch.
- [x] 3.2 Run `openspec validate agent-codex-improve-setup-new-repo-docker-loader-2026-04-21-11-41 --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

## 4. Cleanup

- [x] 4.1 Run `bash scripts/agent-branch-finish.sh --branch agent/codex/improve-setup-new-repo-docker-loader-2026-04-21-11-41 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record PR URL and final merge state.
- [x] 4.3 Confirm sandbox worktree and refs are cleaned up.
