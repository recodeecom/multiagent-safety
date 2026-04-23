# Tasks

## 1. Spec

- [x] Define parent gitlink auto-commit behavior and controls.

## 2. Tests

- [x] Add regression coverage for nested repo finish creating a parent gitlink commit.

## 3. Implementation

- [x] Add parent gitlink detection and path-scoped parent commit to `agent-branch-finish`.
- [x] Pass parent gitlink controls through `gx finish`.

## 4. Cleanup

- [x] Run focused verification.
- [ ] Commit and finish via PR with merge + cleanup evidence.

Verification:
- `bash -n scripts/agent-branch-finish.sh`
- `bash -n templates/scripts/agent-branch-finish.sh`
- `node --test test/cli-args-dispatch.test.js test/finish.test.js`
- `openspec validate agent-codex-auto-commit-parent-subrepo-upgrades-2026-04-23-11-59 --strict`
- `git diff --check`
- `npm test`
