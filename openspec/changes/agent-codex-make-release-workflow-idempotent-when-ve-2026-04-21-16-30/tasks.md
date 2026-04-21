## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-codex-make-release-workflow-idempotent-when-ve-2026-04-21-16-30`.
- [x] 1.2 Define normative requirements in `specs/release-workflow/spec.md`.

## 2. Implementation

- [x] 2.1 Update `.github/workflows/release.yml` so it skips `npm publish` when the current package version already exists on npm.
- [x] 2.2 Add/update `test/metadata.test.js` regression coverage for the release-workflow skip behavior.

## 3. Verification

- [x] 3.1 Run `npm test`, `node --check bin/multiagent-safety.js`, and `npm pack --dry-run`. Result: `npm test` passed `152/152`; `node --check bin/multiagent-safety.js` passed; `npm pack --dry-run` produced `imdeadpool-guardex-7.0.16.tgz`.
- [x] 3.2 Run `openspec validate agent-codex-make-release-workflow-idempotent-when-ve-2026-04-21-16-30 --type change --strict`. Result: `Change 'agent-codex-make-release-workflow-idempotent-when-ve-2026-04-21-16-30' is valid`.
- [x] 3.3 Run `openspec validate --specs`. Result: `No items found to validate.`

## 4. Completion

- [ ] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
