## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `auto-release-writer`.
- [x] 1.2 Define normative requirements in `specs/release-workflow/spec.md`.

## 2. Implementation

- [x] 2.1 Replace the maintainer `gx release` path so it generates GitHub release notes from README history and creates or updates the public GitHub release instead of running `npm publish` directly.
- [x] 2.2 Add focused regression coverage for README aggregation, package-manifest repo targeting, and create-vs-edit GitHub release behavior.
- [x] 2.3 Update operator-facing docs for the new release flow and rewrite the live `v7.0.15` GitHub release body with the generated notes.

## 3. Verification

- [ ] 3.1 Run targeted project verification commands (`node --test test/install.test.js test/metadata.test.js`, `node --check bin/multiagent-safety.js`).
- [x] 3.2 Run `openspec validate auto-release-writer --type change --strict`.
- [x] 3.3 Run `openspec validate --specs`.

Verification note: `node --check bin/multiagent-safety.js` passed. The exact `node --test test/install.test.js test/metadata.test.js` command still timed out after 120s because unrelated `setup`/`doctor` areas in `test/install.test.js` are red in this repo baseline, while the release-focused slice and the inherited `codex-agent` regressions touched here now pass.

## 4. Completion

- [ ] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
