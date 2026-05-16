# Tasks

## 1. Spec

- [x] Capture the README structure contract in `specs/readme/spec.md` (sections `01`–`09`, hero + badges, numbered chips, admonition callouts).

## 2. Tests

- [x] Manual: preview the rewritten `README.md` in GitHub's markdown renderer + on npmjs.com's README panel — all badges, tables, code blocks, and GFM admonitions render cleanly.
- [x] Verify no relative links reference files that don't exist (`./logo.png`, `./LICENSE`).

## 3. Implementation

- [x] Rewrite `README.md` end-to-end against the Claude Design handoff bundle (`sD7EkVZ0h5_9u9LsrWjEDA` → `readme.html`).
- [x] Preserve the existing shields.io badge URLs so live badges keep rendering.
- [x] Bump `@imdeadpool/guardex` 7.0.31 → 7.0.32 so `npm publish` ships the new README in the next release.

## 4. Verification

- [x] Diff confirms README shrunk from 929 → ~260 lines without dropping Install / Workflow / AGENTS.md / Commands / Migration content.
- [x] No other files referenced by the README changed (logo path, LICENSE, shields.io URLs).

## 5. Completion / Cleanup

- [x] Commit on `agent/claude/readme-design-simpler-2026-04-24-00-47`.
- [x] `gx branch finish --branch "agent/claude/readme-design-simpler-2026-04-24-00-47" --base main --via-pr --wait-for-merge --cleanup`.
- [x] Capture PR URL + final `MERGED` evidence in the handoff.
- [x] Confirm the agent worktree under `.omc/agent-worktrees/gitguardex__claude__readme-design-simpler-2026-04-24-00-47` is pruned after merge.
