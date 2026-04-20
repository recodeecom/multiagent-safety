<!-- multiagent-safety:START -->
## Multi-Agent Safety Contract

**Isolation.** Every task runs on a dedicated `agent/*` branch + worktree. Start with `scripts/agent-branch-start.sh "<task>" "<agent-name>"`. Treat the base branch (`main`/`dev`) as read-only while an agent branch is active. Never `git checkout <branch>` on a primary working tree (including nested repos); use `git worktree add` instead. The `.githooks/post-checkout` hook auto-reverts primary-branch switches during agent sessions — bypass only with `GUARDEX_ALLOW_PRIMARY_BRANCH_SWITCH=1`.

**Ownership.** Before editing, claim files: `scripts/agent-file-locks.py claim --branch "<agent-branch>" <file...>`. Before deleting, confirm the path is in your claim. Don't edit outside your scope unless reassigned.

**Handoff gate.** Post a one-line handoff note (plan/change, owned scope, intended action) before editing. Re-read the latest handoffs before replacing others' code.

**Completion.** Finish with `scripts/agent-branch-finish.sh --branch "<agent-branch>" --via-pr --wait-for-merge --cleanup` (or `gx finish --all`). Task is only complete when: commit pushed, PR URL recorded, state = `MERGED`, sandbox worktree pruned. If anything blocks, append a `BLOCKED:` note and stop — don't half-finish.

**Parallel safety.** Assume other agents edit nearby. Never revert unrelated changes. Report conflicts in the handoff.

**Reporting.** Every completion handoff includes: files changed, behavior touched, verification commands + results, risks/follow-ups.

**OpenSpec (when change-driven).** Keep `openspec/changes/<slug>/tasks.md` checkboxes current during work, not batched at the end. Task scaffolds and manual task edits must include an explicit final completion/cleanup section that ends with PR merge + sandbox cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `scripts/agent-branch-finish.sh ... --cleanup`) and records PR URL + final `MERGED` evidence. Verify specs with `openspec validate --specs` before archive. Don't archive unverified.

**Version bumps.** If a change bumps a published version, the same PR updates release notes/changelog.
<!-- multiagent-safety:END -->
