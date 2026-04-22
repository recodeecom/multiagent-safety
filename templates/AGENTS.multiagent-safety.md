<!-- multiagent-safety:START -->
## Multi-Agent Execution Contract (GX)

**Repo toggle.** Guardex is enabled by default. If the repo root `.env` sets `GUARDEX_ON=0`, `false`, `no`, or `off`, treat this entire Guardex contract as disabled for the repo and do not require Guardex worktrees, lock claims, completion flow, or OpenSpec workflow until `GUARDEX_ON` is re-enabled.

**Repo toggle examples.** Add one of these lines to the repo-root `.env` file:
`GUARDEX_ON=0` disables Guardex for that repo.
`GUARDEX_ON=1` explicitly enables Guardex for that repo again.

**Task-size routing.** Small tasks stay in direct caveman-only mode. For typos, single-file tweaks, one-liners, version bumps, or similarly bounded asks, solve directly and do not escalate into heavy OMX orchestration just because a keyword appears. Treat `quick:`, `simple:`, `tiny:`, `minor:`, `small:`, `just:`, and `only:` as explicit lightweight escape hatches.
Promote to OMX orchestration only when the task is medium/large: multi-file behavior changes, API/schema work, refactors, migrations, architecture, cross-cutting scope, or long prompts. Heavy OMX modes (`ralph`, `autopilot`, `team`, `ultrawork`, `swarm`, `ralplan`) are for that larger scope. If the task grows while working, upgrade then.

**Isolation.** Every task runs on a dedicated `agent/*` branch + worktree. Start with `gx branch start "<task>" "<agent-name>"`. Treat the base branch (`main`/`dev`) as read-only while an agent branch is active. Never `git checkout <branch>` on a primary working tree (including nested repos); use `git worktree add` instead. The `.githooks/post-checkout` hook auto-reverts primary-branch switches during agent sessions - bypass only with `GUARDEX_ALLOW_PRIMARY_BRANCH_SWITCH=1`.
For every new task, including follow-up work in the same chat/session, if an assigned agent sub-branch/worktree is already open, continue in that sub-branch instead of creating a fresh lane unless the user explicitly redirects scope.
Never implement directly on the local/base branch checkout; keep it unchanged and perform all edits in the agent sub-branch/worktree.

**Ownership.** Before editing, claim files: `gx locks claim --branch "<agent-branch>" <file...>`. Before deleting, confirm the path is in your claim. Don't edit outside your scope unless reassigned.

**Handoff gate.** Post a one-line handoff note (plan/change, owned scope, intended action) before editing. Re-read the latest handoffs before replacing others' code.

**Completion.** Finish with `gx branch finish --branch "<agent-branch>" --via-pr --wait-for-merge --cleanup` (or `gx finish --all`). Task is only complete when: commit pushed, PR URL recorded, state = `MERGED`, sandbox worktree pruned. If anything blocks, append a `BLOCKED:` note and stop - don't half-finish.
OMX completion policy: when a task is done, the agent must commit the task changes, push the agent branch, and create/update a PR before considering the branch complete.

**Parallel safety.** Assume other agents edit nearby. Never revert unrelated changes. Report conflicts in the handoff.

**Reporting.** Every completion handoff includes: files changed, behavior touched, verification commands + results, risks/follow-ups.

**Open questions.** If Codex/Claude hits an unresolved question, branching decision, or blocker that should survive chat, record it in `openspec/plan/<plan-slug>/open-questions.md` as an unchecked `- [ ]` item. Resolve it in-place when answered instead of burying it in chat-only notes.

**OpenSpec (when change-driven).** Keep `openspec/changes/<slug>/tasks.md` checkboxes current during work, not batched at the end. Task scaffolds and manual task edits must include an explicit final completion/cleanup section that ends with PR merge + sandbox cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `gx branch finish ... --cleanup`) and records PR URL + final `MERGED` evidence. Verify specs with `openspec validate --specs` before archive. Don't archive unverified.

**Version bumps.** If a change bumps a published version, the same PR updates release notes/changelog.
<!-- multiagent-safety:END -->
