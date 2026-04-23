# AGENTS

This document is the agent contract for this repo. It applies identically to Codex, Claude Code, and any other agentic CLI working here. `CLAUDE.md` is a symlink to this file — do not edit them independently.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `.agent/PLANS.md`) from design to implementation.

## Objective

- Optimize for task completion with low token use.
- Prefer phase-based execution over conversational micro-steps.

## Token-Efficient Execution

### Planning

- Start each task with a plan of at most 4 bullets.
- Work in phases:
  1. minimal inspection
  2. grouped edits or grouped repo actions
  3. focused verification
  4. compact summary
- Low output alone is not a defect. A bounded run that finishes in roughly <=10 steps is usually fine; low output stretched across 20+ steps with rising input is fragmentation.
- Treat obvious follow-on actions as part of the active phase; do not stop for tiny internal checkpoints.
- If context grows or the session becomes fragmented, write a short working summary and continue from it.
- Checkpoint after each milestone or roughly every 15-25 tool calls: keep only `task`, `done`, `current status`, `next`, and the latest meaningful evidence; drop the raw transcript from active context.

### Token Discipline

- Do not re-read the same file, line range, or command output unless the file changed or new evidence requires it.
- Prefer targeted reads: `rg`, `head`, `tail`, `git diff`, and exact line ranges.
- Keep command output compact and relevant.
- Avoid repeated status checks unless something changed.
- Treat repeated `sed` / `cat` peeks, tiny diagnostic retries, and repeated `write_stdin` as red flags. When they appear, stop the probe loop and reset to one bounded phase.

### Command Discipline

- Batch related shell commands whenever safe.
- Prefer one-shot non-interactive commands, scripts, or exact invocations over interactive loops or repeated stdin driving.
- For diagnosis, gather the relevant evidence in one pass, then summarize once.
- If the session turns fragmented, collapse back to inspect once, patch once, verify once, and summarize once.

### Git And PR Workflow

- Treat local git and PR work as one bounded phase when possible: inspect status, stage intended files, commit, push, and check PR or CI.
- Do not narrate every trivial git step; summarize branch, commit, PR, and CI state once per phase.

### Reporting

- Use this format:
  1. Plan
  2. Actions taken
  3. Verification
  4. Result
- Keep reports concise and focused on blockers, material changes, and verification outcomes.

### Verification

- Always verify before finalizing.
- Choose the smallest verification that meaningfully proves the change.
- Do not run redundant checks.
- Pause only for destructive actions, ambiguous intent, missing credentials or access, or conflicting evidence.

## Environment

- Python: .venv/bin/python (uv, CPython 3.13.3)
- GitHub auth for git/API is available via env vars: `GITHUB_USER`, `GITHUB_TOKEN` (PAT). Do not hardcode or commit tokens.
- For authenticated git over HTTPS in automation, use: `https://x-access-token:${GITHUB_TOKEN}@github.com/<owner>/<repo>.git`

## Guardex Toggle

- Guardex is enabled for this repo by default.
- If the repo root `.env` sets `GUARDEX_ON=0`, `false`, `no`, or `off`, treat every Guardex-managed workflow requirement in this file as disabled for that repo.
- Disabled mode means: no required Guardex worktrees, no required Guardex lock-claim flow, no required Guardex PR/cleanup flow, and no required OpenSpec workflow from this contract until `GUARDEX_ON` is set back to a truthy value.
- `GUARDEX_ON=1`, `true`, `yes`, or `on` explicitly re-enables the Guardex workflow.
- Repo-root `.env` examples:
- `GUARDEX_ON=0` disables Guardex for this repo.
- `GUARDEX_ON=1` explicitly enables Guardex for this repo again.

## Code Conventions

The `/project-conventions` skill is auto-activated on code edits (PreToolUse guard).

| Convention              | Location                              | When                         |
| ----------------------- | ------------------------------------- | ---------------------------- |
| Code Conventions (Full) | `/project-conventions` skill          | On code edit (auto-enforced) |
| Git Workflow            | `.agents/conventions/git-workflow.md` | Commit / PR                  |

## UI/UX Skill Default (UI Pro Max)

- For any frontend/UI/UX request (new page, component, styling, layout, redesign, or UI review), **always load and apply** `.codex/skills/ui-ux-pro-max/SKILL.md` first.
- Treat `ui-ux-pro-max` as the default UI decision surface unless the user explicitly asks to skip it.
- Follow the skill workflow before implementation (including design-system guidance) so generated UI stays consistent and high quality.

## Git Hygiene Preference

- Prefer committing and pushing completed work by default unless the user explicitly asks to keep it local.
- Do not commit ephemeral local runtime artifacts (for example `.dev-ports.json` and `apps/logs/*.log`).
- Treat local OMX/Codex session state files as agent-ignored (as if they were in `.gitignore`) even when they appear in working tree status.
- Never stage or commit:
  - `.agents/settings.local.json`
  - `.omc/project-memory.json`
  - `.omc/state/**`
  - `.omx/state/**`

## Claude Code Workflow

When Guardex is enabled, Claude Code sessions use the same agent-worktree + OpenSpec flow as Codex; there is no separate `claude-agent.sh` wrapper — Claude calls the generic scripts directly.

### Tiering (token-aware scaffolding)

`gx branch start` and `gx branch finish` accept `--tier {T0|T1|T2|T3}` to size the OpenSpec scaffolding to the change's blast radius. Default is `T3` (full scaffolding; current behavior). The tier is recorded in the bootstrap manifest so `finish` picks it up automatically.

| Tier | Use for | Scaffolding on `start` | Gates on `finish` |
|------|---------|------------------------|--------------------|
| `T0` | typos, dep bumps, format-only, comment-only | none (no `openspec/changes/` or `openspec/plan/` files) | tasks gate skipped |
| `T1` | ≤5 files, 1 capability, no API/schema change | `openspec/changes/<slug>/notes.md` + `.openspec.yaml` only | tasks gate skipped |
| `T2` | behavior change, API/schema, multi-module | full change workspace (`proposal.md`, `tasks.md`, `specs/.../spec.md`); no plan workspace | full gates |
| `T3` | cross-cutting, multi-agent, plan-driven | full change workspace + plan workspace with role `tasks.md` files | full gates |

Examples:

```bash
# T0 (typo / trivial): fastest path, no OpenSpec artifacts
gx branch start --tier T0 "fix-typo-in-readme" "claude-name"

# T1 (small fix): notes-only scaffold, commit message is the spec of record
gx branch start --tier T1 "tighten-retry-backoff" "claude-name"

# T2 (default for real behavior changes): full change spec, no plan workspace
gx branch start --tier T2 "add-oauth-endpoint" "claude-name"

# T3 (current default if --tier is omitted): plan workspace + full OpenSpec
gx branch start "refactor-payment-pipeline" "claude-name"
```

`finish` reads the tier from the manifest automatically; passing `--tier` on finish is only needed to override (e.g., upgrading to a fuller gate).

1. Start a sandbox worktree:

   ```bash
   gx branch start [--tier T0|T1|T2|T3] "<task>" "claude-<name>"
   ```

   Creates `agent/claude-<name>/<slug>` under `.omc/agent-worktrees/`, scaffolds the OpenSpec change + plan workspaces (sized by tier), and records the bootstrap manifest. Codex sessions keep using `.omx/agent-worktrees/`. Missing `codex-auth` silently falls back to an empty snapshot slug (expected for Claude sessions).

2. Work inside the sandbox only:

   ```bash
   cd .omc/agent-worktrees/agent__claude-<name>__<slug>
   gx locks claim --branch "agent/claude-<name>/<slug>" <file...>
   # implement + commit inside this worktree
   ```

   Do not edit the primary `dev` checkout; multiagent-safety rules apply unchanged.

3. Finish via PR + cleanup:

   ```bash
   gx branch finish \
     --branch "agent/claude-<name>/<slug>" \
     --base main --via-pr --wait-for-merge --cleanup
   ```

   Runs the OpenSpec tasks gate, merge-quality gate, and worktree prune — identical to the Codex path.

#### Default Claude finish (non-negotiable)

Claude's default completion command **must** include all four flags in this order: `--via-pr --wait-for-merge --cleanup`. Never stop at bare `--via-pr`; that strands commits and leaves worktrees dirty (see the stalled-worktree recovery section). The only time to deviate is when the user explicitly asks to keep the lane open (e.g. "don't merge yet", "leave the branch").

When branch protection blocks a direct merge, enable auto-merge as soon as the PR URL is known so `--wait-for-merge` can observe the state transition:

```bash
# finish also prints the PR URL / number; use it immediately:
gh pr merge <PR-NUMBER> --repo <owner>/<repo> --auto --squash
```

If checks are slow, extend the poll window rather than dropping the flag:

```bash
GUARDEX_FINISH_MERGE_TIMEOUT=3600 \
  gx branch finish \
    --branch "agent/claude-<name>/<slug>" \
    --base main --via-pr --wait-for-merge --cleanup
```

One-shot sweep for multiple finished lanes:

```bash
gx finish --all       # iterates every agent/* branch the current user owns
```

If `gx branch finish --cleanup` reports a worktree held by a `__source-probe-*` temp path, recover with:

```bash
git worktree remove --force .omc/agent-worktrees/agent__claude__<slug>
git worktree prune
git branch -D agent/claude/<slug>
```

Notes:

- Slash commands `/opsx:*` in `.claude/commands/opsx/` drive the OpenSpec artifact flow.
- `.claude/settings.json` already wires the `skill_activation` / `skill_guard` hooks, so project-conventions enforcement runs automatically on edits.
- `skill_guard` blocks most Bash commands while the shell is on `dev`; run the `gx branch ...`, `gx locks ...`, and `gx branch finish ...` commands from within the worktree, or prefix the invocation with `ALLOW_BASH_ON_NON_AGENT_BRANCH=1` when calling from the primary checkout.

### Stalled agent worktree recovery

The Guardex Codex launcher auto-finishes a branch only when the codex CLI exits cleanly inside it. If the agent is killed, crashes, runs out of budget, or is started directly via `gx branch start` without the launcher, the worktree is left dirty with no commits and no PR — a "stalled" worktree.

`scripts/agent-stalled-report.sh` is a quiet wrapper around `scripts/agent-autofinish-watch.sh --once --dry-run` that surfaces stalled worktrees. It is wired as a `SessionStart` hook in `.claude/settings.json`, so each Claude Code session begins with a one-line summary per stalled branch (and is silent when nothing is stalled).

To act on the report:

- Inspect: `bash scripts/agent-autofinish-watch.sh --once --dry-run`
- Auto-finish once (commit dirty changes, push, create PR, attempt merge): `bash scripts/agent-autofinish-watch.sh --once --auto-merge`
- Run the daemon (poll forever, auto-finish after `--idle-seconds`): `bash scripts/agent-autofinish-watch.sh --daemon --auto-merge`

Defaults: `--idle-seconds=900` (15 min of file silence before auto-commit) and `--branch-prefix=agent/`. The watcher is conservative — it never touches branches outside the configured prefix and only commits worktrees whose files have stopped changing.

## Multi-Agent Execution Contract (Default)

Use this contract whenever multiple agents are active in parallel.

The marker-managed `multiagent-safety` section below is the canonical lifecycle contract for branch/worktree startup, completion chain (`commit -> push -> create/update PR -> merged`), and PR/merge/cleanup evidence.

Apply these repo-specific supplements in addition to that canonical contract:

1. Local base safety
- Local `dev` is protected: never edit, stage, or commit task changes directly on `dev`.
- If currently checked out on `dev`, create the agent branch/worktree first and only then begin edits.
- Creating or attaching an agent worktree must never switch the primary local checkout branch.
- `agent-branch-start` and `agent-branch-finish` must fast-forward local `dev` from `origin/dev` before branch creation/merge.

2. Ownership and lock discipline
- Claim owned files before edits: `gx locks claim --branch "<agent-branch>" <file...>`.
- If `main.rs` is in scope, claim lock first: `python3 scripts/main_rs_lock.py claim --owner "<agent-name>" --branch "<agent-branch>"`.
- Non-integrator branches must not edit `main.rs` unless explicit emergency override is approved.
- Pre-commit blocks `agent/*` commits with unclaimed files or missing valid `main.rs` lock.

3. Shared behavior protection
- Do not delete, replace, or simplify critical paths (auth/session/proxy/API wiring) without explicit request or approved checkpoint plus regression coverage.
- Preserve parallel safety: never revert unrelated changes and report handoff conflicts.

4. Integrator finalization gate
- Final handoff must include files changed, behavior touched, verification commands/results, and risks/follow-ups.
- Integrator confirms no critical behavior loss, respected ownership boundaries, and verification gates passed.

## Versioning Rule

- If a change publishes or bumps a package version, the same change must also update the release notes / changelog entries. See [Documentation & Release Notes](#documentation--release-notes) for where to record change notes.

## Workflow (OpenSpec-first)

When Guardex is enabled, this repo uses **OpenSpec as the primary workflow and SSOT** for change-driven development.

### OpenSpec philosophy (enforced)

- fluid, not rigid
- iterative, not waterfall
- easy to apply, not process-heavy
- built for brownfield and greenfield work
- scalable from solo projects to large teams

### How to work (default)

1. Use the default artifact-guided flow first: `/opsx:propose <idea>` -> `/opsx:apply` -> `/opsx:archive`.
2. For **every** repo change (feature, fix, refactor, chore, test, config, docs), create/update an OpenSpec change in `openspec/changes/**` before editing code.
   Exception: helper agent branches that target another `agent/*` base branch are execution-only assists and must not create standalone OpenSpec change/spec/tasks docs; keep documentation on the owner change branch.
3. Keep artifacts editable throughout implementation (proposal/spec/design/tasks are living docs, not rigid phase gates).
4. Implement from `tasks.md`; keep code and specs in sync (update `spec.md` as behavior changes).
5. Keep `tasks.md` checkpoint status updated continuously during execution; mark items as soon as they complete (do not batch-update at the end).
6. Default `tasks.md` scaffolds and manual task edits must include a final completion/cleanup section that ends with PR merge + sandbox cleanup (`gx branch finish ... --cleanup` or `gx finish --all`) and captures PR URL + final `MERGED` handoff evidence.
7. Validate specs locally: `openspec validate --specs`.
8. Verify before archiving (`/opsx:verify <change>` when applicable); never archive unverified changes.

### OpenSpec tooling freshness (required)

- Keep the global CLI current:
  - `npm install -g @fission-ai/openspec@latest`
- Refresh project-local AI guidance/slash commands after updates:
  - `openspec update`
- If expanded workflow commands are needed (`/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:verify`, `/opsx:sync`, `/opsx:bulk-archive`, `/opsx:onboard`), select a profile and refresh:
  - `openspec config profile <profile-name>`
  - `openspec update`

### Source of Truth

- **Specs/Design/Tasks (SSOT)**: `openspec/`
  - Active changes: `openspec/changes/<change>/`
  - Main specs: `openspec/specs/<capability>/spec.md`
  - Archived changes: `openspec/changes/archive/YYYY-MM-DD-<change>/`

## Documentation & Release Notes

- **Do not add/update feature or behavior documentation under `docs/`**. Use OpenSpec context docs under `openspec/specs/<capability>/context.md` (or change-level context under `openspec/changes/<change>/context.md`) as the SSOT.
- **Do not edit `CHANGELOG.md` directly.** Leave changelog updates to the release process; record change notes in OpenSpec artifacts instead.

### Documentation Model (Spec + Context)

- `spec.md` is the **normative SSOT** and should contain only testable requirements.
- Use `openspec/specs/<capability>/context.md` for **free-form context** (purpose, rationale, examples, ops notes).
- If context grows, split into `overview.md`, `rationale.md`, `examples.md`, or `ops.md` within the same capability folder.
- Change-level notes live in `openspec/changes/<change>/context.md` or `notes.md`, then **sync stable context** back into the main context docs.

Prompting cue (use when writing docs):
"Keep `spec.md` strictly for requirements. Add/update `context.md` with purpose, decisions, constraints, failure modes, and at least one concrete example."

### Commands (recommended)

- Default flow (recommended): `/opsx:propose <idea>` -> `/opsx:apply` -> `/opsx:archive`
- Expanded flow start: `/opsx:new <kebab-case>`
- Continue artifacts: `/opsx:continue <change>`
- Fast-forward artifacts: `/opsx:ff <change>`
- Verify before archive: `/opsx:verify <change>`
- Sync delta specs → main specs: `/opsx:sync <change>`
- Bulk archive completed changes: `/opsx:bulk-archive`
- Guided onboarding workflow: `/opsx:onboard`
- Create/refresh plan workspace: `/opsx:plan <plan-slug>`
- Update plan checkpoint: `/opsx:checkpoint <plan-slug> <role> <checkpoint-id> <state> <text...> [--phase <phase-id>]` (`--phase` syncs the matching line in `openspec/plan/<slug>/phases.md` using the same `--state`)
- Watch team -> plan checkpoints: `/opsx:watch-plan <team-name> <plan-slug>`

## Plan Workspace Contract (`openspec/plan`)

Use `openspec/plan/README.md` as the operational runbook and `openspec/plan/PLANS.md` as the planner narrative-writing contract.

Default quick flow:
1. Create/maintain `openspec/plan/<plan-slug>/`.
2. Create/maintain `openspec/plan/<plan-slug>/open-questions.md`.
3. Keep `open-questions.md` current; when Codex/Claude hits an unresolved question, branching decision, or blocker that should survive chat, record it there as an unchecked `- [ ]` item.
4. Keep role `tasks.md` files current (`planner`, `architect`, `critic`, `executor`, `writer`, `verifier`).
5. Keep checklist headings visible: `## 1. Spec`, `## 2. Tests`, `## 3. Implementation`, `## 4. Checkpoints`, plus a final cleanup section (`## 5. Cleanup` or `## 6. Cleanup`).
6. Update checkboxes continuously while work progresses.
7. Execute from approved `planner/plan.md` with role ownership.
8. Verify with evidence before archive/finish.

Helper sub-branch exception:
- When a helper branch targets another `agent/*` owner branch, implementation is allowed in helper lanes, but OpenSpec change/spec/tasks artifacts stay owned by the owner branch.

Scaffold command:

```bash
scripts/openspec/init-plan-workspace.sh <plan-slug>
```

<!-- multiagent-safety:START -->
## Multi-Agent Execution Contract (GX)

**Repo toggle.** Guardex is enabled by default. If the repo root `.env` sets `GUARDEX_ON=0`, `false`, `no`, or `off`, treat this entire Guardex contract as disabled for the repo and do not require Guardex worktrees, lock claims, completion flow, or OpenSpec workflow until `GUARDEX_ON` is re-enabled.

**Repo toggle examples.** Add one of these lines to the repo-root `.env` file:
`GUARDEX_ON=0` disables Guardex for that repo.
`GUARDEX_ON=1` explicitly enables Guardex for that repo again.

**Task-size routing.** Small tasks stay in direct caveman-only mode. For typos, single-file tweaks, one-liners, version bumps, or similarly bounded asks, solve directly and do not escalate into heavy OMX orchestration just because a keyword appears. Treat `quick:`, `simple:`, `tiny:`, `minor:`, `small:`, `just:`, and `only:` as explicit lightweight escape hatches.
Promote to OMX orchestration only when the task is medium/large: multi-file behavior changes, API/schema work, refactors, migrations, architecture, cross-cutting scope, or long prompts. Heavy OMX modes (`ralph`, `autopilot`, `team`, `ultrawork`, `swarm`, `ralplan`) are for that larger scope. If the task grows while working, upgrade then.

## Token / Context Budget

Default: less word, same proof.

- For prompts about `token inefficiency`, `reviewer mode`, `minimal token overhead`, or session waste patterns, switch into low-overhead mode: plan in at most 4 bullets, execute by phase, batch related reads/commands, avoid duplicate reads and interactive loops, keep outputs compact, and verify once per phase.
- Low output alone is not a defect. A bounded run that finishes in roughly <=10 steps is usually fine; low output spread across 20+ steps with rising per-turn input is fragmentation and should be treated as context growth first.
- Startup / resume summaries stay tiny: `branch`, `task`, `blocker`, `next step`, and `evidence`.
- Memory-driven starts stay ordered: read active `.omx/state` first, then one live `.omx/notepad.md` handoff, then external memory only when the task depends on prior repo decisions, a previous lane, or ambiguous continuity. Stop after the first 1-2 relevant hits.
- Front-load scaffold/path discovery into one grouped inspection pass. Avoid serial `ls` / `find` / `rg` / `cat` retries that only rediscover the same path state.
- Treat repeated `write_stdin`, repeated `sed` / `cat` peeks, and tiny diagnostic follow-up checks as strong negative signals. If they appear alongside climbing input cost, stop the probe loop and batch the next phase.
- Tool / hook summaries stay tiny: command, status, last meaningful lines only. Drop routine hook boilerplate.
- Keep raw terminal interaction out of long-lived context. For `write_stdin` or interactive babysitting, retain only process, action sent, current result, and next action.
- Keep execution log separate from reasoning context: full commands/stdout belong in logs, while prompt context keeps only the latest 1-2 checkpoints plus the newest tool-result summary.
- Treat local edit/commit, remote publish/PR, CI diagnosis, and cleanup as bounded phases. Do not spend fresh narration or approval turns on obvious safe follow-ons inside an already authorized phase unless the risk changes.
- When a session turns fragmented, collapse back to inspect once, patch once, verify once, and summarize once.
- Use a fixed checkpoint shape when compacting: `Task`, `Done`, `Current status`, and `Next`.
- Keep `.omx/notepad.md` lean: live handoffs only. Use exactly `branch`, `task`, `blocker`, `next step`, and `evidence`; move narrative proof into OpenSpec artifacts, PRs, or command output.

## OMX Caveman Style

- Commentary and progress updates use smart-caveman `ultra` by default: drop articles, filler, pleasantries, and hedging. Fragments are fine when they stay clear.
- Answer order stays fixed: answer first, cause next, fix or next step last. If yes/no fits, say yes/no first.
- Keep literals exact: code, commands, file paths, flags, env vars, URLs, numbers, timestamps, and error text are never caveman-compressed.
- Auto-clarity wins: switch back to `lite` or normal wording for security warnings, irreversible actions, privacy/compliance notes, ordered instructions where fragments may confuse, or when the user is confused and needs more detail.
- Boundaries stay normal/exact for code, commits, PR text, specs, logs, and blocker evidence.

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
