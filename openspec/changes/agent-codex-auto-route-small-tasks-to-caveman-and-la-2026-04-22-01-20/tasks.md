## 1. Spec

- [x] 1.1 Define Guardex-managed task-size routing requirements for small versus larger tasks.

## 2. Implementation

- [x] 2.1 Add the task-size routing clause to `templates/AGENTS.multiagent-safety.md`.
- [x] 2.2 Update install/setup refresh tests so the managed AGENTS block is locked to the new routing policy.

## 3. Verification

- [x] 3.1 Run targeted Guardex install tests for managed AGENTS refresh coverage.
- [x] 3.2 Run `openspec validate agent-codex-auto-route-small-tasks-to-caveman-and-la-2026-04-22-01-20 --type change --strict`.

## 4. Cleanup

- [ ] 4.1 Commit the Guardex template/test update with Lore trailers.
- [ ] 4.2 Push the agent branch and open/update the PR.
- [ ] 4.3 Merge to `main` and prune the sandbox worktree.
- [ ] 4.4 Record PR URL and final `MERGED` evidence.
