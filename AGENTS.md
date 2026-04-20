# AGENTS

This document is the agent contract for this repo. It applies identically to Codex, Claude Code, and any other agentic CLI working here. `CLAUDE.md` is a symlink to this file — do not edit them independently.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `.agent/PLANS.md`) from design to implementation.

## Environment

- Python: .venv/bin/python (uv, CPython 3.13.3)
- GitHub auth for git/API is available via env vars: `GITHUB_USER`, `GITHUB_TOKEN` (PAT). Do not hardcode or commit tokens.
- For authenticated git over HTTPS in automation, use: `https://x-access-token:${GITHUB_TOKEN}@github.com/<owner>/<repo>.git`

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

Claude Code sessions use the same agent-worktree + OpenSpec flow as Codex; there is no separate `claude-agent.sh` wrapper — Claude calls the generic scripts directly.

### Tiering (token-aware scaffolding)

`agent-branch-start.sh` and `agent-branch-finish.sh` accept `--tier {T0|T1|T2|T3}` to size the OpenSpec scaffolding to the change's blast radius. Default is `T3` (full scaffolding; current behavior). The tier is recorded in the bootstrap manifest so `finish` picks it up automatically.

| Tier | Use for | Scaffolding on `start` | Gates on `finish` |
|------|---------|------------------------|--------------------|
| `T0` | typos, dep bumps, format-only, comment-only | none (no `openspec/changes/` or `openspec/plan/` files) | tasks gate skipped |
| `T1` | ≤5 files, 1 capability, no API/schema change | `openspec/changes/<slug>/notes.md` + `.openspec.yaml` only | tasks gate skipped |
| `T2` | behavior change, API/schema, multi-module | full change workspace (`proposal.md`, `tasks.md`, `specs/.../spec.md`); no plan workspace | full gates |
| `T3` | cross-cutting, multi-agent, plan-driven | full change workspace + plan workspace with role `tasks.md` files | full gates |

Examples:

```bash
# T0 (typo / trivial): fastest path, no OpenSpec artifacts
bash scripts/agent-branch-start.sh --tier T0 "fix-typo-in-readme" "claude-name"

# T1 (small fix): notes-only scaffold, commit message is the spec of record
bash scripts/agent-branch-start.sh --tier T1 "tighten-retry-backoff" "claude-name"

# T2 (default for real behavior changes): full change spec, no plan workspace
bash scripts/agent-branch-start.sh --tier T2 "add-oauth-endpoint" "claude-name"

# T3 (current default if --tier is omitted): plan workspace + full OpenSpec
bash scripts/agent-branch-start.sh "refactor-payment-pipeline" "claude-name"
```

`finish` reads the tier from the manifest automatically; passing `--tier` on finish is only needed to override (e.g., upgrading to a fuller gate).

1. Start a sandbox worktree:

   ```bash
   bash scripts/agent-branch-start.sh [--tier T0|T1|T2|T3] "<task>" "claude-<name>"
   ```

   Creates `agent/claude-<name>/<slug>` under `.omx/agent-worktrees/`, scaffolds the OpenSpec change + plan workspaces (sized by tier), and records the bootstrap manifest. Missing `codex-auth` silently falls back to an empty snapshot slug (expected for Claude sessions).

2. Work inside the sandbox only:

   ```bash
   cd .omx/agent-worktrees/agent__claude-<name>__<slug>
   python3 scripts/agent-file-locks.py claim --branch "agent/claude-<name>/<slug>" <file...>
   # implement + commit inside this worktree
   ```

   Do not edit the primary `dev` checkout; multiagent-safety rules apply unchanged.

3. Finish via PR + cleanup:

   ```bash
   bash scripts/agent-branch-finish.sh \
     --branch "agent/claude-<name>/<slug>" \
     --base dev --via-pr --wait-for-merge --cleanup
   ```

   Runs the OpenSpec tasks gate, merge-quality gate, and worktree prune — identical to the Codex path.

Notes:

- Slash commands `/opsx:*` in `.claude/commands/opsx/` drive the OpenSpec artifact flow.
- `.claude/settings.json` already wires the `skill_activation` / `skill_guard` hooks, so project-conventions enforcement runs automatically on edits.
- `skill_guard` blocks most Bash commands while the shell is on `dev`; run the start/claim/finish commands from within the worktree, or prefix the invocation with `ALLOW_BASH_ON_NON_AGENT_BRANCH=1` when calling from the primary checkout.

### Stalled agent worktree recovery

`codex-agent.sh` auto-finishes a branch only when the codex CLI exits cleanly inside it. If the agent is killed, crashes, runs out of budget, or is started directly via `agent-branch-start.sh` (no `codex-agent.sh` wrapper), the worktree is left dirty with no commits and no PR — a "stalled" worktree.

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
- Claim owned files before edits: `python3 scripts/agent-file-locks.py claim --branch "<agent-branch>" <file...>`.
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

This repo uses **OpenSpec as the primary workflow and SSOT** for change-driven development.

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
6. Default `tasks.md` scaffolds and manual task edits must include a final completion/cleanup section that ends with PR merge + sandbox cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `scripts/agent-branch-finish.sh ... --cleanup`) and captures PR URL + final `MERGED` handoff evidence.
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
2. Keep role `tasks.md` files current (`planner`, `architect`, `critic`, `executor`, `writer`, `verifier`).
3. Keep checklist headings visible: `## 1. Spec`, `## 2. Tests`, `## 3. Implementation`, `## 4. Checkpoints`.
4. Update checkboxes continuously while work progresses.
5. Execute from approved `planner/plan.md` with role ownership.
6. Verify with evidence before archive/finish.

Helper sub-branch exception:
- When a helper branch targets another `agent/*` owner branch, implementation is allowed in helper lanes, but OpenSpec change/spec/tasks artifacts stay owned by the owner branch.

Scaffold command:

```bash
scripts/openspec/init-plan-workspace.sh <plan-slug>
```

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
