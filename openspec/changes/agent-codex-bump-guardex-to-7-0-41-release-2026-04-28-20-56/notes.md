# agent-codex-bump-guardex-to-7-0-41-release-2026-04-28-20-56 (minimal / T1)

Branch: `agent/codex/bump-guardex-to-7-0-41-release-2026-04-28-20-56`

Bump `@imdeadpool/guardex` to `7.0.41` and cut a matching GitHub release so
the Colony companion payload from `main` has a fresh npm version available for
manual `npm publish`.

Scope:
- Bump `package.json` and `package-lock.json` from `7.0.40` to `7.0.41`.
- Add a `README.md` release note for `v7.0.41` describing the npm version
  reason and Colony companion payload.
- Verify the package tarball before finish so the maintainer can run
  `npm publish --access public` from the merged release commit.

Verification:
- `node --test --test-name-pattern "setup (skips global install when companion npm tools are already installed|installs only missing global tools|warns when user declines oh-my-claudecode dependency install|installs missing local companion tools with explicit approval|warns when gh dependency is missing)" test/setup.test.js`
- `node --test test/status.test.js`
- `node --check bin/multiagent-safety.js`
- `npm pack --dry-run`
- `openspec validate --specs`
- `git diff --check`

Known baseline:
- Full `node --test test/setup.test.js` currently fails outside this release diff
  on managed AGENTS wording and dirty-worktree reuse assertions. The focused
  companion setup slice above passed 5/5.

## Handoff

- Handoff: change=`agent-codex-bump-guardex-to-7-0-41-release-2026-04-28-20-56`; branch=`agent/codex/bump-guardex-to-7-0-41-release-2026-04-28-20-56`; scope=`package.json, package-lock.json, README.md, openspec/changes/agent-codex-bump-guardex-to-7-0-41-release-2026-04-28-20-56/*`; action=`finish this sandbox via PR merge + cleanup after targeted verification`.
- Copy prompt: Continue `agent-codex-bump-guardex-to-7-0-41-release-2026-04-28-20-56` on branch `agent/codex/bump-guardex-to-7-0-41-release-2026-04-28-20-56`. Work inside the existing sandbox, review `openspec/changes/agent-codex-bump-guardex-to-7-0-41-release-2026-04-28-20-56/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/bump-guardex-to-7-0-41-release-2026-04-28-20-56 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/bump-guardex-to-7-0-41-release-2026-04-28-20-56 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
