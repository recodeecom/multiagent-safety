## 1. Specification

- [x] 1.1 Capture the parity gap between `recodee`'s live OpenSpec helpers and the published `gitguardex` setup-managed copies.
- [x] 1.2 Define normative requirements for richer change and plan scaffolds in `specs/agent-codex-sync-recodee-openspec-bootstrap-into-gx-2026-04-21-17-20/spec.md`.

## 2. Implementation

- [x] 2.1 Sync `scripts/openspec/*` and `templates/scripts/openspec/*` to the richer `recodee` scaffolds.
- [x] 2.2 Keep mirrored frontend copies aligned where Guardex still ships duplicate helper surfaces.
- [x] 2.3 Update regression tests to lock the richer scaffold outputs.

## 3. Verification

- [x] 3.1 Run focused `node --test` coverage for the OpenSpec scaffold/install tests.
- [x] 3.2 Run `node --check bin/multiagent-safety.js`.
- [x] 3.3 Run `openspec validate agent-codex-sync-recodee-openspec-bootstrap-into-gx-2026-04-21-17-20 --type change --strict`.
- [x] 3.4 Run `openspec validate --specs`.

Verification note: `node --test --test-name-pattern OpenSpec test/install.test.js` passed with 4 focused OpenSpec/install tests. `node --test test/metadata.test.js` passed with 14 metadata/parity tests. `node --check bin/multiagent-safety.js` passed. `git diff --check` passed. `openspec validate agent-codex-sync-recodee-openspec-bootstrap-into-gx-2026-04-21-17-20 --type change --strict` passed, and `openspec validate --specs` returned `No items found to validate.`

## 4. Cleanup

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
