# agent-codex-fix-release-workflow-base-ref-2026-04-22-23-34 (minimal / T1)

Branch: `agent/codex/fix-release-workflow-base-ref-2026-04-22-23-34`

The `v7.0.23` GitHub release exists, but the release workflow failed in `Verify` before npm publish because the tag checkout did not provide `origin/main` or `main` for the Active Agents base-version guard test. Fetch the full git history during the release workflow so the guard can resolve the base ref on release/tag runs, and lock that behavior with metadata coverage.

Scope:
- Update `.github/workflows/release.yml` checkout to fetch full history.
- Add a metadata assertion that the release workflow keeps `fetch-depth: 0`.
- Merge the fix, then rerun the release workflow manually on `main` so `@imdeadpool/guardex@7.0.23` can publish.

Verification:
- `node --test test/metadata.test.js --test-name-pattern "release workflow publishes with provenance in CI|release workflow only publishes from published releases or manual dispatch"`
- `gh workflow run "Release to npm (provenance)" --repo recodeee/gitguardex --ref main`
- `gh run list --repo recodeee/gitguardex --workflow "Release to npm (provenance)" --limit 3 --json databaseId,displayTitle,event,status,conclusion,url,headBranch`
- `npm view @imdeadpool/guardex version dist-tags --json`

## Handoff

- Handoff: change=`agent-codex-fix-release-workflow-base-ref-2026-04-22-23-34`; branch=`agent/codex/fix-release-workflow-base-ref-2026-04-22-23-34`; scope=`.github/workflows/release.yml, test/metadata.test.js, openspec/changes/agent-codex-fix-release-workflow-base-ref-2026-04-22-23-34/*`; action=`merge workflow-only fix, manually rerun release workflow on main, and verify npm advances to 7.0.23`.
- Copy prompt: Continue `agent-codex-fix-release-workflow-base-ref-2026-04-22-23-34` on branch `agent/codex/fix-release-workflow-base-ref-2026-04-22-23-34`. Work inside the existing sandbox, review `openspec/changes/agent-codex-fix-release-workflow-base-ref-2026-04-22-23-34/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/fix-release-workflow-base-ref-2026-04-22-23-34 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [x] Run: `gx branch finish --branch agent/codex/fix-release-workflow-base-ref-2026-04-22-23-34 --base main --via-pr --wait-for-merge --cleanup`
- [x] Run: `gh workflow run "Release to npm (provenance)" --repo recodeee/gitguardex --ref main`
- [x] Record PR URL + `MERGED` state and rerun evidence in the completion handoff.
- [x] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
