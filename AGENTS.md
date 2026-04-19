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

## CLI Session Detection Lock (Dashboard / Accounts)

The current CLI session detection behavior is intentionally frozen and must stay order-sensitive.

Canonical implementation:

- `frontend/src/utils/account-working.ts`
  - `hasActiveCliSessionSignal(...)`
  - `hasFreshLiveTelemetry(...)`
  - `getFreshDebugRawSampleCount(...)`

Locked detection cascade (do not reorder):

1. `codexAuth.hasLiveSession`
2. Fresh live telemetry / live session count
3. Tracked session counters (`codexTrackedSessionCount` / `codexSessionCount`)
4. Fresh debug raw samples

Regression lock:

- `frontend/src/utils/account-working.test.ts` (`hasActiveCliSessionSignal` + `isAccountWorkingNow` suites)

Rule for future edits:

- Do not change this cascade unless explicitly requested by the user and accompanied by updated regression tests proving the new behavior.

## Rust Runtime Proxy Lock (`rust/codex-lb-runtime/src/main.rs`)

The Rust runtime should stay a **thin proxy** for app APIs unless explicitly requested otherwise.

Canonical routing posture:

- Keep wildcard pass-through routes enabled:
  - `/api/{*path}`
  - `/backend-api/{*path}`
  - `/v1/{*path}`
- Prefer generic proxy handlers over large explicit per-endpoint Rust route lists.

Auth/session rule:

- Treat Python as the source of truth for dashboard auth/session enforcement (`validate_dashboard_session` and related dependencies).
- Do not duplicate or drift auth/session logic in Rust endpoint copies unless the user explicitly requests moving that logic into Rust and corresponding tests are updated.

Parallel-work safety:

- When editing `main.rs`, assume other agents may be changing Python API surfaces at the same time.
- Prefer compatibility-preserving proxy behavior over endpoint-specific Rust implementations that can break on concurrent backend changes.
- `main.rs` is now lock-protected for parallel agent sessions. Before **any** edit to
  `rust/codex-lb-runtime/src/main.rs`, claim ownership:
  - `python3 scripts/main_rs_lock.py claim --owner "<agent-name>" --branch "<agent-branch>"`
  - Check owner/lease: `python3 scripts/main_rs_lock.py status`
  - Release when done: `python3 scripts/main_rs_lock.py release --branch "<agent-branch>"`
- Lock ownership is **branch-scoped**; if lock branch and current branch differ, edits are blocked.
- `main.rs` is **integrator-only** by default: branch must match `agent/integrator/...` (configurable via `MAIN_RS_INTEGRATOR_AGENT`).
- If the lock is held by another agent, do not edit `main.rs`; continue in owned module files or hand off to the integrator.

Required verification before claiming Rust runtime changes are complete:

- Confirm wildcard proxy routes still exist in `app_with_state(...)`.
- Confirm proxy helpers are still present and used by wildcard routes.
- Run:
  - `cargo check -p codex-lb-runtime`
  - `cargo test -p codex-lb-runtime --no-run`
- If route/auth behavior changed, add/adjust Rust runtime tests in `rust/codex-lb-runtime/src/main.rs` test module.

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

- `rust/codex-lb-runtime/src/main.rs` stays integrator-only; non-integrator Claude branches must not edit it (see [Rust Runtime Proxy Lock](#rust-runtime-proxy-lock-rustcodex-lb-runtimesrcmainrs)).
- Slash commands `/opsx:*` in `.claude/commands/opsx/` drive the OpenSpec artifact flow.
- `.claude/settings.json` already wires the `skill_activation` / `skill_guard` hooks, so project-conventions enforcement runs automatically on edits.
- `skill_guard` blocks most Bash commands while the shell is on `dev`; run the start/claim/finish commands from within the worktree, or prefix the invocation with `ALLOW_BASH_ON_NON_AGENT_BRANCH=1` when calling from the primary checkout.

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

4. Rust runtime verification gate
- For Rust runtime edits, run:
  - `bun run verify:rust-runtime-guardrails`
  - `cargo check -p codex-lb-runtime`
  - `cargo test -p codex-lb-runtime --no-run`
- Do not claim completion without command output evidence.

5. Integrator finalization gate
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
6. Validate specs locally: `openspec validate --specs`.
7. Verify before archiving (`/opsx:verify <change>` when applicable); never archive unverified changes.

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
- Update plan checkpoint: `/opsx:checkpoint <plan-slug> <role> <checkpoint-id> <state> <text...>`
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
## Multi-Agent Execution Contract (multiagent-safety)

0. Session plan comment + read gate (required)

- Before editing, each agent must post a short session comment/handoff note that includes:
  - plan/change name (or checkpoint id),
  - owned files/scope,
  - intended action.
- Before deleting/replacing code, each agent must read the latest session comments/handoffs first and confirm the target code is in their owned scope.
- If ownership is unclear or overlaps, stop that edit, post a blocker comment, and let the leader/integrator reassign scope.
- For git isolation, each agent must start on a dedicated branch via `scripts/agent-branch-start.sh "<task-or-plan>" "<agent-name>"`.
- Treat the base branch (`main` or the user's current local base branch) as read-only while the agent branch is active.
- Agent completion defaults to `scripts/codex-agent.sh`, which auto-finishes the branch (auto-commit changed files, push/create PR, attempt merge, and pull the local base branch after merge).
- Auto-finish now waits for required checks/merge and then cleans merged sandbox branch/worktree by default.
- Cleanup for merged `agent/*` branches is mandatory; `agent-branch-finish` must not report completion while local/remote refs or sandbox worktree cleanup is still pending.
- Cleanup automation must be branch-scoped: do not prune other agents' current worktrees during finish; only the source branch sandbox may be auto-removed.
- Other agent worktrees may be pruned only when they are explicitly targeted or have no active local changes.
- If codex-agent auto-finish cannot complete, immediately run `scripts/agent-branch-finish.sh --branch "<agent-branch>" --via-pr --wait-for-merge` and keep the branch open until checks/review pass.
- If merge/rebase conflicts block auto-finish, run a conflict-resolution review pass in that sandbox branch, then rerun `agent-branch-finish.sh --via-pr` until merged.
- Completion is not valid until these are true: commit exists on the agent branch, branch is pushed to `origin`, and PR/merge status is produced by `agent-branch-finish.sh` or `codex-agent`.
- Completion report must include the PR URL and explicit merge state (`OPEN`/`MERGED`); without this, the task is not complete.
- For every new task, if an assigned agent sub-branch/worktree is already open, continue in that sub-branch; otherwise create a fresh one from the current local base snapshot with `scripts/agent-branch-start.sh`.
- Never implement directly on the local/base branch checkout; keep it unchanged and perform all edits in the agent sub-branch/worktree.
- Agent worktree startup must preserve the primary local checkout branch exactly as-is; branch switching is allowed only inside the agent worktree.
- If the change publishes or bumps a version, the same change must also update release notes/changelog entries.

1. Explicit ownership before edits

- Assign each agent clear file/module ownership.
- Do not edit files outside your assigned scope unless the leader reassigns ownership.

2. Preserve parallel safety

- Assume other agents are editing nearby code concurrently.
- Never revert unrelated changes authored by others.
- If another change conflicts with your approach, adapt and report the conflict in handoff.

3. Verify before completion

- Run required local checks for the area you changed.
- Do not mark work complete without command output evidence.

4. Required handoff format (every agent)

- Files changed
- Behavior touched
- Verification commands + results
- Risks / follow-ups

## OpenSpec Multi-Codex Change Management (owner + joined Codexes)

Use this checklist for active OpenSpec changes when one owner Codex may receive help from joined Codexes (including other worktree Codexes). Apply this to current changes such as `agent-codex-admin-compastor-com-retry-merge-zeus-improve-integrate-ref-cleanup`.

Joined helper branches that merge into another `agent/*` branch are documentation-exempt assist lanes; they implement assigned scope only and report handoff evidence back to the owner branch artifacts.

Checkpoint discipline (required): update the active change `tasks.md` during work, checkpoint-by-checkpoint, and keep checkbox state synchronized with current progress.

**Definition of Done (applies to every active change):** the change is complete only when every checkbox below is checked AND the agent branch reaches `MERGED` state on `origin` with the PR URL + state recorded in the completion handoff. If verification halts (test failure, conflict, ambiguous result), append a `BLOCKED:` line under the cleanup section explaining the blocker and **STOP** — do not silently skip the cleanup pipeline. Surfacing a blocker is preferred over a half-finished completion.

## 1. Specification

- [ ] 1.1 Finalize proposal scope and acceptance criteria for the active change.
- [ ] 1.2 Define normative requirements in the change spec (`specs/<capability>/spec.md`).

## 2. Implementation

- [ ] 2.1 Implement scoped behavior changes.
- [ ] 2.2 Add/update focused regression coverage.

## 3. Verification

- [ ] 3.1 Run targeted project verification commands.
- [ ] 3.2 Run `openspec validate <change-slug> --type change --strict`.
- [ ] 3.3 Run `openspec validate --specs`.

## 4. Collaboration (only when another Codex joins)

- [ ] 4.1 Owner Codex records each joined Codex (branch/worktree + scope) before accepting work.
- [ ] 4.2 Joined Codexes may review, propose solution tasks, and implement only within assigned scope.
- [ ] 4.3 Owner Codex must acknowledge joined outputs (accept/revise/reject) before moving to cleanup.
- [ ] 4.4 If no Codex joined, mark this section `N/A` and continue.

## 5. Cleanup (mandatory; run before claiming completion)

- [ ] 5.1 Run the cleanup pipeline: `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base dev --via-pr --wait-for-merge --cleanup`. This handles commit → push → PR create → merge wait → worktree prune in one invocation.
- [ ] 5.2 Record the PR URL and final merge state (`MERGED`) in the completion handoff.
- [ ] 5.3 Confirm the sandbox worktree is gone (`git worktree list` no longer shows the agent path; `git branch -a` shows no surviving local/remote refs for the branch).

For change specs that need explicit baseline requirement wording, use this pattern:

## ADDED Requirements

### Requirement: retry-merge-zeus-improve-integrate-ref-cleanup behavior
The system SHALL enforce retry-merge-zeus-improve-integrate-ref-cleanup behavior as defined by this change.

#### Scenario: Baseline acceptance
- **WHEN** retry-merge-zeus-improve-integrate-ref-cleanup behavior is exercised
- **THEN** the expected outcome is produced
- **AND** regressions are covered by tests.

## OpenSpec Plan Workspace (recommended)

When work needs a durable planning phase, scaffold a plan workspace before implementation:

```bash
bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"
```

Expected shape:

```text
openspec/plan/<plan-slug>/
  summary.md
  checkpoints.md
  planner/plan.md
  planner/tasks.md
  architect/tasks.md
  critic/tasks.md
  executor/tasks.md
  writer/tasks.md
  verifier/tasks.md
```
<!-- multiagent-safety:END -->
