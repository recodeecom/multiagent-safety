## 1. Spec

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-setup-protected-main-sandbox-2026-04-21-12-20`.
- [x] 1.2 Define normative requirements in `specs/setup-protected-main-sandbox/spec.md`.

## 2. Implementation

- [x] 2.1 Route protected-`main` setup refreshes through the sandbox bootstrap path instead of hard-blocking.
- [x] 2.2 Sync the managed setup outputs back into the protected base workspace and clean up the temporary sandbox.
- [x] 2.3 Add/update focused regression coverage in `test/install.test.js`.

## 3. Verification

- [x] 3.1 Run `node --check bin/multiagent-safety.js`.
- [x] 3.2 Run `node --test --test-name-pattern="setup .*protected main" test/install.test.js`.
- [x] 3.3 Run `openspec validate agent-codex-setup-protected-main-sandbox-2026-04-21-12-20 --type change --strict`.

## 4. Cleanup (mandatory; run before claiming completion)

- [x] 4.1 Run `bash scripts/agent-branch-finish.sh --branch agent/codex/setup-protected-main-sandbox-2026-04-21-12-08 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 4.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [x] 4.3 Confirm the sandbox worktree is gone and no agent refs remain for the branch.
