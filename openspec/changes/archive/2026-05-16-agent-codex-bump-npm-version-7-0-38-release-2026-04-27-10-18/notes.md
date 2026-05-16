# agent-codex-bump-npm-version-7-0-38-release-2026-04-27-10-18 (minimal / T1)

Branch: `agent/codex/bump-npm-version-7-0-38-release-2026-04-27-10-18`

Ship the next Guardex npm patch release by bumping `@imdeadpool/guardex`
from `7.0.37` to `7.0.38`, adding the matching README release note, and
cutting the matching GitHub release after the release branch merges.

Scope:
- Update `package.json` and `package-lock.json` to `7.0.38`.
- Add the `v7.0.38` README release note.
- Verify the package metadata and tarball before finish.
- Finish through PR merge, sandbox cleanup, and GitHub release creation.

Verification:
- `npm test`
- `node --check bin/multiagent-safety.js`
- `npm pack --dry-run`

## Handoff

- Handoff: change=`agent-codex-bump-npm-version-7-0-38-release-2026-04-27-10-18`; branch=`agent/codex/bump-npm-version-7-0-38-release-2026-04-27-10-18`; scope=`package.json, package-lock.json, README.md, openspec/changes/agent-codex-bump-npm-version-7-0-38-release-2026-04-27-10-18/*`; action=`finish this sandbox via PR merge + cleanup, then create GitHub release v7.0.38`.
- Copy prompt: Continue `agent-codex-bump-npm-version-7-0-38-release-2026-04-27-10-18` on branch `agent/codex/bump-npm-version-7-0-38-release-2026-04-27-10-18`. Work inside the existing sandbox, review `openspec/changes/agent-codex-bump-npm-version-7-0-38-release-2026-04-27-10-18/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/bump-npm-version-7-0-38-release-2026-04-27-10-18 --base main --via-pr --wait-for-merge --cleanup`, then create GitHub release `v7.0.38`.

## Cleanup

- [x] Run: `gx branch finish --branch agent/codex/bump-npm-version-7-0-38-release-2026-04-27-10-18 --base main --via-pr --wait-for-merge --cleanup`
- [x] Record PR URL + `MERGED` state in the completion handoff.
- [x] Create or update GitHub release `v7.0.38`.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
