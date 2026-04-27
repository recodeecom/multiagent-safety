## 1. Spec

- [x] 1.1 Capture why branch start inside an active agent sandbox should attach instead of cloning the sandbox.
- [x] 1.2 Define the reuse behavior and explicit new-lane escape hatch.

## 2. Implementation

- [x] 2.1 Update branch-start runtime and template scripts to reuse the current `agent/*` worktree by default.
- [x] 2.2 Keep parser surfaces compatible with reused branch-start output.
- [x] 2.3 Add focused regression coverage for the existing-worktree reuse path.

## 3. Verification

- [x] 3.1 Run targeted branch-start regression tests.
- [x] 3.2 Run template parity and script syntax checks.
- [x] 3.3 Run `openspec validate agent-codex-reuse-existing-agent-worktree-on-repeate-2026-04-27-18-17 --type change --strict`.
- [x] 3.4 Run `openspec validate --specs`.

Verification evidence:
- `node --test test/branch.test.js` (pass, 30/30)
- `node --test test/metadata.test.js` (pass, 24/24)
- `npm test` (pass, 288 passed, 1 skipped)
- `bash -n scripts/agent-branch-start.sh`, `bash -n templates/scripts/agent-branch-start.sh`, `bash -n scripts/agent-branch-merge.sh`, `bash -n templates/scripts/agent-branch-merge.sh` (pass)
- `git diff --check` (pass)
- `openspec validate agent-codex-reuse-existing-agent-worktree-on-repeate-2026-04-27-18-17 --type change --strict` (pass)
- `openspec validate --specs` (pass; no spec items found)

## 4. Cleanup

- [ ] 4.1 Commit, push, open/update PR, merge, and clean up the worktree.
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone.
