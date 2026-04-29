# agent-codex-bump-npm-version-7-0-42-release-2026-04-29-22-36 (minimal / T1)

Branch: `agent/codex/bump-npm-version-7-0-42-release-2026-04-29-22-36`

Bump `@imdeadpool/guardex` to `7.0.42` and cut a matching GitHub release so
the merged Guardex changes after `v7.0.41` have a fresh npm package version.

Scope:
- Bump `package.json` and `package-lock.json` from `7.0.41` to `7.0.42`.
- Add a `README.md` release note for `v7.0.42` covering PRs `#451` through
  `#473`.
- Verify package metadata and tarball contents before finish.

Verification:
- `node --check bin/multiagent-safety.js`
- `npm pack --dry-run`
- `openspec validate --specs`
- `git diff --check`
- `npm test` when the current baseline allows it

Known baseline:
- Full `npm test` was red before this release edit on unrelated agent launch,
  agent session, and CLI args assertions. Keep release verification scoped to
  metadata, release notes, and package tarball unless those baseline failures
  are fixed separately.

## Handoff

- Handoff: change=`agent-codex-bump-npm-version-7-0-42-release-2026-04-29-22-36`; branch=`agent/codex/bump-npm-version-7-0-42-release-2026-04-29-22-36`; scope=`package.json, package-lock.json, README.md, openspec/changes/agent-codex-bump-npm-version-7-0-42-release-2026-04-29-22-36/*`; action=`finish this sandbox via PR merge + cleanup after targeted verification`.
- Copy prompt: Continue `agent-codex-bump-npm-version-7-0-42-release-2026-04-29-22-36` on branch `agent/codex/bump-npm-version-7-0-42-release-2026-04-29-22-36`. Work inside the existing sandbox, review `openspec/changes/agent-codex-bump-npm-version-7-0-42-release-2026-04-29-22-36/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/bump-npm-version-7-0-42-release-2026-04-29-22-36 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/bump-npm-version-7-0-42-release-2026-04-29-22-36 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
