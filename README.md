# GuardeX — Guardian T-Rex for your repo

[![npm version](https://img.shields.io/npm/v/%40imdeadpool%2Fguardex?color=cb3837&logo=npm)](https://www.npmjs.com/package/@imdeadpool/guardex)
[![CI](https://github.com/recodeee/guardex/actions/workflows/ci.yml/badge.svg)](https://github.com/recodeee/guardex/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/recodeee/guardex/badge)](https://securityscorecards.dev/viewer/?uri=github.com/recodeee/guardex)

GuardeX is a safety layer for parallel Codex/agent work in git repos.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

## Frontend Repo

- Standalone frontend repository: https://github.com/Webu-PRO/guardex-frontend
- This repository tracks/mirrors the frontend under `frontend/` as documented below.

## The problem (what was going wrong)

Multiple Codex agents worked on the same files at the same time.
They started overwriting or deleting each other's changes.
Progress became **de-progressive**: more activity, less real forward movement.

GuardeX exists to stop that loop.

![Multi-agent dashboard example](https://raw.githubusercontent.com/recodeee/guardex/main/docs/images/dashboard-multi-agent.png)

```mermaid
flowchart LR
    A[Agent A edits shared files] --> S[Same target surface]
    B[Agent B edits shared files] --> S
    C[Agent C edits shared files] --> S
    D[Agent D edits shared files] --> S
    E[Agent E edits shared files] --> S
    S --> F[Conflict / overwrite churn]
    F --> G[Deleted or lost code]
    G --> H[Rework and confusion]
    H --> I[Regression risk grows]
    I --> F
```

## What GuardeX enforces

- isolated `agent/*` branch + worktree per task
- explicit file lock claiming before edits
- deletion guard for claimed files
- protected-base branch safety (`main`, `dev`, `master` by default)
- repair/doctor flow when drift appears

## Copy-paste: install + bootstrap

```sh
npm i -g @imdeadpool/guardex
cd /path/to/your/repo
gx setup
```

Alias support:

- preferred: `gx`
- full: `guardex`

## Copy-paste: daily workflow (per new user task)

```sh
# 1) Start isolated branch/worktree
bash scripts/agent-branch-start.sh "task-name" "agent-name"

# 2) Claim ownership
python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>

# 3) Implement + verify
npm test

# 4) Finish (commit/push/PR/merge flow)
bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)" --base dev --via-pr --wait-for-merge

# 5) Optional cleanup after merge
gx cleanup --branch "$(git rev-parse --abbrev-ref HEAD)"
```

If you use `scripts/codex-agent.sh`, the finish flow is auto-run after the Codex session exits.
It auto-commits sandbox changes, retries once after syncing if the branch moved behind base during the run, then pushes/opens PR merge flow against `dev`.

If you run Codex in multiple existing agent worktrees directly (for example from VS Code Source Control), finalize all completed branches with:

```sh
gx finish --all
```

## Visual workflow

### Setup status

![gx setup behavior screenshot](https://raw.githubusercontent.com/recodeee/guardex/main/docs/images/setup-success.svg)

### Service logs/status

![gx status logs screenshot](https://raw.githubusercontent.com/recodeee/guardex/main/docs/images/status-tools-logs.svg)

### Branch/worktree start protocol

![gx branch start protocol screenshot](https://raw.githubusercontent.com/recodeee/guardex/main/docs/images/workflow-branch-start.svg)

### Lock + delete guard protocol

![gx lock and delete guard screenshot](https://raw.githubusercontent.com/recodeee/guardex/main/docs/images/workflow-lock-guard.svg)

### VS Code Source Control layout (agent + OpenSpec files)

![VS Code Source Control layout with OpenSpec files](https://raw.githubusercontent.com/recodeee/guardex/main/docs/images/workflow-source-control.svg)

## Copy-paste: common commands

```sh
# health check (default when run with no args)
gx status
gx status --strict        # exit non-zero on findings (v6 name: gx scan)

# bootstrap, repair, verify — all in one
gx setup
gx setup --repair         # repair only (v6 name: gx fix)
gx setup --install-only   # scaffold templates, skip global installs (v6 name: gx install)
gx doctor                 # repair + verify (auto-sandboxes on protected main)

# target another repo without switching your current checkout
gx setup --target /path/to/repo
gx doctor --target /path/to/repo
# optional VS Code workspace showing repo + agent worktrees
gx setup --target /path/to/repo --parent-workspace-view

# monorepo with nested git repos (e.g. /mainfolder/.git + /mainfolder/apps/*/.git)
# setup auto-installs into every nested repo; use --no-recursive to limit to the top-level
gx setup --target /mainfolder
gx setup --target /mainfolder --no-recursive

# protected branch management
gx protect list
gx protect add release staging
gx protect remove release

# sync current agent branch with origin/<base>
gx sync --check
gx sync

# background bots (review monitor + stale cleanup)
gx agents start
gx agents stop
gx agents status

# per-agent-branch lifecycle
gx finish --all           # commit + PR + merge every ready agent/* branch
gx cleanup                # prune merged/stale branches and worktrees
gx cleanup --watch --interval 60

# AI-ready setup prompt (paste into Codex/Claude)
gx prompt                 # full checklist        (v6 name: gx copy-prompt)
gx prompt --exec          # commands only         (v6 name: gx copy-commands)
gx prompt --snippet       # AGENTS.md managed block template

# reports
gx report scorecard --repo github.com/recodeee/guardex
```

### v6 → v7 command migration

Five commands were consolidated into flags. Old names still work and print a one-line deprecation notice; they'll be removed in v8.

| v6 command             | v7 replacement           |
| ---------------------- | ------------------------ |
| `gx init`              | `gx setup`               |
| `gx install`           | `gx setup --install-only`|
| `gx fix`               | `gx setup --repair`      |
| `gx scan`              | `gx status --strict`     |
| `gx copy-prompt`       | `gx prompt`              |
| `gx copy-commands`     | `gx prompt --exec`       |
| `gx print-agents-snippet` | `gx prompt --snippet` |
| `gx review`            | `gx agents start` (runs review + cleanup) |

### Continuous stale branch cleanup bot

Use this to auto-prune idle `agent/*` worktrees created by Codex while keeping active worktrees untouched.

```sh
# watch cleanup loop every minute (default idle threshold is 10 minutes when --watch is enabled)
gx cleanup --watch --interval 60

# one-shot cleanup for branches idle at least 10 minutes
gx cleanup --idle-minutes 10

# run a single watch cycle (helpful for cron/CI checks)
gx cleanup --watch --once --interval 60
```

### Repo Agent Supervisor (start both bots with one command)

```sh
# starts review bot + cleanup bot in background for the current repo
gx agents start

# optional tuning
gx agents start --review-interval 30 --cleanup-interval 60 --idle-minutes 10

# show whether both bots are running for this repo
gx agents status

# stop both bots and clear repo-local state
gx agents stop
```

## Important behavior defaults

- No command defaults to `gx status`.
- `gx init` is alias of `gx setup`.
- Setup/doctor can install missing global OMX/OpenSpec/codex-auth with explicit Y/N confirmation.
- `gx setup` checks GitHub CLI (`gh`) and prints install guidance if missing.
- Optional parent-folder VS Code Source Control view: `gx setup --target /path/to/repo --parent-workspace-view` creates `../<repo>-branches.code-workspace`.
- Monorepo-aware: when the target contains nested git repos (e.g. `apps/*/.git`), `gx setup` installs the workflow into every discovered repo. Git submodules (`.git` files) and guardex worktrees under `.omx/agent-worktrees/` are skipped. Opt out with `--no-recursive`; tune discovery with `--max-depth <n>`, `--skip-nested <dir>`, and `--include-submodules`.
- Interactive self-update prompt defaults to **No** (`[y/N]`).
- In initialized repos, `setup`/`install`/`fix` block protected-base writes unless explicitly overridden.
- Direct commits/pushes to protected branches are blocked by default.
- Exception: VS Code Source Control commits are allowed on protected branches that exist only locally (no upstream and no remote branch).
- Optional repo override for manual VS Code protected-branch writes: `git config multiagent.allowVscodeProtectedBranchWrites true`.
- Codex/agent sessions stay blocked on protected branches and must use `agent/*` branch + PR workflow.
- On protected `main`, `gx doctor` auto-runs in a sandbox agent branch/worktree.
- In-place agent branching is disabled; `scripts/agent-branch-start.sh` always creates a separate worktree to keep your visible local/base branch unchanged.
- `scripts/agent-branch-start.sh` hydrates `scripts/codex-agent.sh` into new sandbox worktrees when missing, so auto-finish launcher flow stays available.

## Configure protected branches

Default protected branches:

- `dev`
- `main`
- `master`

```sh
gx protect list
gx protect set main release hotfix
gx protect reset
```

Stored in git config key:

```text
multiagent.protectedBranches
```

## Companion dependency: GitHub CLI (`gh`)

GuardeX PR/merge automation depends on GitHub CLI (`gh`), including
`agent-branch-finish.sh` PR flows and `codex-agent.sh` auto-finish behavior.

Install + verify:

```sh
# install guide: https://cli.github.com/
gh --version
gh auth status
```

## Optional GitHub Apps: fork sync + PR review

### Pull app (Probot fork sync)

GuardeX setup now installs a starter file at `.github/pull.yml.example`.

To enable fork auto-sync:

```sh
cp .github/pull.yml.example .github/pull.yml
```

Then edit `.github/pull.yml`:

- set `rules[].base` to your fork branch (`main`, `master`, or `dev`)
- set `rules[].upstream` to `<upstream-owner>:<branch>`

Install the app: <https://github.com/apps/pull>  
Validate config: `https://pull.git.ci/check/<owner>/<repo>`

### CR-GPT code review app

Install app: <https://github.com/apps/cr-gpt>

`gx setup` also installs `.github/workflows/cr.yml` (GitHub Actions review workflow).

Then in your repo:

1. `Settings -> Secrets and variables -> Actions`
2. open `Variables`
3. add `OPENAI_API_KEY`

After that, the app reviews new and updated pull requests automatically.

## Frontend mirror sync (`Webu-PRO/guardex-frontend`)

This repo includes `.github/workflows/sync-frontend-mirror.yml`, which mirrors
the `frontend/` subtree to a separate repository whenever `main` receives
changes under `frontend/**`.

Default target:

- repo: `Webu-PRO/guardex-frontend`
- branch: `main`

Required setup (in this repository):

1. `Settings -> Secrets and variables -> Actions`
2. Add repository secret `GUARDEX_FRONTEND_MIRROR_PAT`
   - value must be a token with `contents:write` access to `Webu-PRO/guardex-frontend`

Optional overrides (Actions Variables):

- `GUARDEX_FRONTEND_MIRROR_REPO` (default `Webu-PRO/guardex-frontend`)
- `GUARDEX_FRONTEND_MIRROR_BRANCH` (default `main`)

Manual run:

```sh
gh workflow run sync-frontend-mirror.yml
```

## Companion dependency: `codex-auth` account switcher

For multi-identity Codex workflows, GuardeX pairs with
[`codex-auth`](https://github.com/recodeecom/codex-account-switcher-cli).

Install:

```sh
npm i -g @imdeadpool/codex-account-switcher
```

Common commands:

```sh
codex-auth save <name>
codex-auth use <name>
codex-auth list --details
codex-auth current
```

## Files installed by setup

```text
scripts/agent-branch-start.sh
scripts/agent-branch-finish.sh
scripts/codex-agent.sh
scripts/review-bot-watch.sh
scripts/agent-worktree-prune.sh
scripts/agent-file-locks.py
scripts/install-agent-git-hooks.sh
scripts/openspec/init-plan-workspace.sh
.githooks/pre-commit
.githooks/pre-push
.codex/skills/guardex/SKILL.md
.claude/commands/guardex.md
.github/pull.yml.example
.github/workflows/cr.yml
.omx/state/agent-file-locks.json
```

If `package.json` exists, setup also adds `agent:*` helper scripts.

## OpenSpec quick start after `gx setup`

If you enabled global OpenSpec install during setup (`@fission-ai/openspec`), use the full guide here:

- [`docs/openspec-getting-started.md`](./docs/openspec-getting-started.md)

Default core flow:

```text
/opsx:propose <change-name> -> /opsx:apply -> /opsx:archive
```

Optional expanded flow:

```sh
openspec config profile <profile-name>
openspec update
```

```text
/opsx:new <change-name> -> /opsx:ff or /opsx:continue -> /opsx:apply -> /opsx:verify -> /opsx:archive
```

### OpenSpec in agent sub-branches

- `scripts/codex-agent.sh` enforces OpenSpec workspaces before it launches Codex in each sandbox branch/worktree.
- `scripts/agent-branch-start.sh` can scaffold both `openspec/changes/<agent-branch-slug>/` and `openspec/plan/<agent-branch-slug>/` when you set `GUARDEX_OPENSPEC_AUTO_INIT=true`.
- Set `GUARDEX_OPENSPEC_AUTO_INIT=false` (default for `agent-branch-start`) to skip branch-start auto-bootstrap.
- Set `GUARDEX_OPENSPEC_PLAN_SLUG=<kebab-case-slug>` to force a specific plan workspace name.
- Set `GUARDEX_OPENSPEC_CHANGE_SLUG=<kebab-case-slug>` to force a specific change workspace name.
- Set `GUARDEX_OPENSPEC_CAPABILITY_SLUG=<kebab-case-slug>` to override the default capability folder used for `spec.md` scaffolding.

## Security and maintenance posture

- CI matrix on Node 18/20/22 (`npm test`, `node --check`, `npm pack --dry-run`)
- trusted publishing with provenance in GitHub Actions
- OpenSSF Scorecard + Dependabot for Actions
- disclosure policy in [`SECURITY.md`](./SECURITY.md)

## Local development

```sh
npm test
node --check bin/multiagent-safety.js
npm pack --dry-run
```

## Release notes

### v7.0.6

- **Fixed: self-updater lied about success.** `gx`'s update prompt runs `npm i -g @imdeadpool/guardex@latest` and previously trusted npm's exit code. When npm's resolution cache made it report "changed 1 package" without actually overwriting the files (a known quirk triggered when the user just bumped from N-1 → N in the same session, or with a warm metadata cache), the prompt kept re-firing on every subsequent `gx` invocation because the on-disk `package.json` was still stale. `gx` now re-reads the globally installed `package.json` after the `@latest` install returns, compares its `version` field to the advertised latest, and if they don't match runs a pinned retry `npm i -g @imdeadpool/guardex@<latest>` to force the cache past the obstructing entry. If the pinned retry also fails to advance the on-disk version, the user gets a clear hint (`npm root -g && npm cache verify`) instead of a silent loop.

### v7.0.5

- **Added: `oh-my-claude` to `gx status` global-toolchain check.** The Claude-side mirror of `oh-my-codex` is now reported alongside the existing services (`oh-my-codex`, `@fission-ai/openspec`, `@imdeadpool/codex-account-switcher`, `gh`). Users who have not yet installed it will see a clear "inactive" line instead of silent omission, matching the existing codex detection contract.
- **Added: `.omc/` to the managed `.gitignore` block.** `gx setup` / `gx doctor` write a `.omc/` entry next to `.omx/` so Claude-specific runtime state (notepad, worktrees landing there in a follow-up) stays out of commits by default, parity with the existing `.omx/` treatment.

### v7.0.4

- **Fixed: publish collision on npm.** Advanced the package metadata from `7.0.3` to `7.0.4` so `npm publish` no longer targets an already published version.
- **Changed: release-note sync for versioning rule.** Added this versioned entry in README in the same change as the package bump to keep publish metadata and release notes aligned.

### v7.0.3

- **Branch/worktree naming refactor.** `agent-branch-start.sh` now produces `agent/<role>/<task>-<YYYY-MM-DD>-<HH-MM>` instead of `agent/<role+account-email>/<snapshot-slug>-<task>-<cksum6>`. Codex account names (e.g. `Zeus Edix Hu`) and 6-hex checksums no longer leak into branch or worktree paths.
- **Role normalization.** `AGENT_NAME` is collapsed to `{claude, codex, <explicit>}` via (in order) the `GUARDEX_AGENT_TYPE` env override, a substring match against `claude`/`codex`, the `CLAUDECODE=1` sentinel, or a fallback to `codex`. Other roles (`integrator`, `executor`, etc.) pass through when set via `GUARDEX_AGENT_TYPE`.
- **New `--print-name-only` flag** on `agent-branch-start.sh` for deterministic tests; honours `GUARDEX_BRANCH_TIMESTAMP` for reproducible output.
- **`--tier` flag accepted silently** for CLAUDE.md compatibility (scaffold sizing not wired through yet).
- Tests `install.test.js` covering the old snapshot-slug format were rewritten to assert the new role-datetime shape.

### v7.0.2

- **Fix: `__source-probe-*` worktree leak on conflict exit.** `agent-branch-finish.sh` was registering its `cleanup()` trap *after* the sync-guard rebase block, so when that rebase hit conflicts and the script exited, the throwaway probe worktree was never removed. `gx doctor` sweeps against stalled branches accumulated one new probe per run.
- The cleanup trap is now installed immediately after probe creation, and aborts any in-progress `rebase`/`merge` before `worktree remove --force` so conflict-stuck probes are cleaned up reliably.

### v7.0.1

- Maintenance release.

### v7.0.0

- **Breaking (soft).** Consolidated 17 commands into 12 visible commands with flag-based subcommands. Five removed names (`init`, `install`, `fix`, `scan`, `copy-prompt`, `copy-commands`, `print-agents-snippet`, `review`) still work but print a one-line deprecation notice on stderr and will be removed in v8. See the migration table in "Copy-paste: common commands" above.
- **Token-usage improvements.** Trimmed the auto-installed agent templates that live inside every consumer repo and get loaded into every Claude/Codex session:
  - `templates/AGENTS.multiagent-safety.md`: 6990 B → 1615 B (−77%)
  - `templates/codex/skills/guardex/SKILL.md`: 2732 B → 1086 B (−60%)
  - `templates/claude/commands/guardex.md`: 472 B → 357 B (−24%)
  - Total: 10194 B → 3058 B per consumer repo (−70%, ~1.5k fewer tokens per agent session).

  The `AI_SETUP_PROMPT` and `AI_SETUP_COMMANDS` constants used by `gx prompt` are now compact checklists, so piping `gx prompt` into a model context is cheaper too.
- **New `gx prompt` command** replaces three prompt-emitting commands: `gx prompt` (full checklist), `gx prompt --exec` (commands only), `gx prompt --snippet` (AGENTS.md managed-block template).
- **New flag surface on `gx setup`**: `--install-only` (templates/hooks/locks only), `--repair` (fix drift), plus the existing `--target`, `--parent-workspace-view`, `--dry-run`, etc.
- **New `gx status --strict`** mirrors the old `gx scan` behavior (exit non-zero on findings).
- Updated internal `REQUIRED_PACKAGE_SCRIPTS` for consumer `package.json` so `agent:safety:scan` and `agent:safety:fix` helper scripts now invoke the new v7 surface (`gx status --strict`, `gx setup --repair`).

### v6.0.1

- Preserve existing repo-owned `AGENTS.md` marker content during `gx setup` / `gx doctor` by default; only rewrite marker blocks when `--force` is explicitly used.
- Preserve existing `agent:*` package scripts during setup/doctor repairs by default so repo-local command customizations are not silently replaced.
- Forward `--force` through sandboxed doctor execution so intentional canonical template/script rewrites still work end-to-end.
- Added regression tests for both preservation behaviors (`setup` + `doctor`).
- Bumped package version from `6.0.0` to `6.0.1` for the next npm publish.

### v6.0.0

- **Breaking** — removed the legacy `musafety` bin alias and all `MUSAFETY_*` environment variables. Callers must migrate to the `guardex` / `gx` bins and the `GUARDEX_*` env-var surface.
- **Breaking** — bootstrap manifest filename changed from `musafety-bootstrap-manifest.json` to `guardex-bootstrap-manifest.json`; existing sandbox worktrees must be pruned + re-bootstrapped (or have their manifest manually renamed).
- Rebranded all remaining `musafety` / `Musafety` / `MUSAFETY` codename tokens to `guardex` / `Guardex` / `GUARDEX` across scripts, templates, hooks, tests, and docs.
- The descriptive phrase `multiagent-safety` (including `bin/multiagent-safety.js` and `templates/AGENTS.multiagent-safety.md`) is preserved intentionally — only the short codename changed.
- Bumped package version from `5.0.17` to `6.0.0` for the next npm publish.

### v5.0.17

- Bumped package version from `5.0.16` to `5.0.17` for the next npm publish.

### v5.0.16

- Fixed `gx doctor` runtime crash (`parseDoctorArgs is not defined`) by restoring the doctor argument parser for `--target` and `--strict`.
- Fixed `gx doctor` command routing so the repair-first doctor flow remains the active command path (duplicate legacy doctor definition no longer overrides it).
- Updated worktree change detection to run `git status --porcelain --untracked-files=normal --` for consistent normal untracked-file behavior.
- Added regression coverage that asserts the doctor parser function exists in `bin/multiagent-safety.js`.
- Bumped package version from `5.0.15` to `5.0.16`.

### v5.0.15

- Added `gx setup --parent-workspace-view` to generate a parent-folder VS Code workspace (`../<repo>-branches.code-workspace`) that shows both the base repo and `.omx/agent-worktrees` in Source Control.
- Added dry-run-safe parent workspace operations (`would-create` / `would-update`) and setup output that prints the created workspace path.
- Added regression coverage for parent workspace generation and dry-run behavior.
- Bumped package version from `5.0.14` to `5.0.15`.

### v5.0.14

- Changed release metadata for the next npm publish by bumping package version from `5.0.13` to `5.0.14`.
- Kept Guardex release notes synchronized with the published package version.

### v5.0.13

- Bumped package version from `5.0.12` to `5.0.13` for the next npm publish.

### v5.0.12

- Bumped package version from `5.0.11` to `5.0.12` for the next npm publish.
- Updated repository metadata and README links to the renamed GitHub repository (`recodeee/guardex`).

### v5.0.11

- Updated the managed AGENTS contract wording to use `GX` naming and added an explicit OMX completion policy requiring commit + push + PR creation/update at task completion.
- Ensured `gx install` explicitly configures the managed `AGENTS.md` policy block and added regression coverage for this install-path behavior.
- Bumped package version from `5.0.10` to `5.0.11` for the next npm publish.

### v5.0.10

- Bumped package version from `5.0.9` to `5.0.10` for the next npm publish.

### v5.0.9

- Enforced OpenSpec workspace bootstrap for sandbox agent execution: `scripts/codex-agent.sh` now initializes `openspec/plan/<agent-branch-slug>/` before launching Codex, and `scripts/agent-branch-start.sh` supports `GUARDEX_OPENSPEC_AUTO_INIT` plus `GUARDEX_OPENSPEC_PLAN_SLUG`.
- Tightened doctor auto-finish correctness: sandbox finish now waits for merge and exits non-zero if the PR closes without merge, so repair flows are not reported as complete when policy blocks merge.
- Updated package version from `5.0.8` to `5.0.9` for the next npm publish.

### v5.0.8

- Fixed `bin/multiagent-safety.js` syntax regressions in the doctor sandbox flow (`Unexpected identifier` / `Unexpected end of input`) that were breaking CLI execution and CI tests.
- Restored `scripts/codex-agent.sh` from `templates/scripts/codex-agent.sh` so critical runtime helper parity checks pass in clean CI clones.
- Bumped package version from `5.0.7` to `5.0.8` for the next npm publish.

### v5.0.7
### Unreleased (generated draft, not versioned yet)

- Add the user-facing changes for the next release here before assigning a version number.
- Keep this section focused on behavior changes (`Added`, `Changed`, `Fixed`) rather than version-bump-only notes.

### v5.0.6

- `gx cleanup` and auto-finish cleanup now prune clean agent worktrees by default, so VS Code Source Control focuses on your local branch plus worktrees with active changes.
- Added `gx cleanup --keep-clean-worktrees` to opt out and keep clean worktrees visible.
- Bumped package version from `5.0.5` to `5.0.6` for the next npm publish.

### v5.0.5

- Bumped package version from `5.0.4` to `5.0.5` so npm publish can proceed with the next patch release.

### v5.0.4

- Bumped package version from `5.0.3` to `5.0.4` to stay one patch ahead of the current npm published version.

### v5.0.3

- Bumped package version from `5.0.2` to `5.0.3` for the next npm publish.

### v5.0.2

- Auto-closes Codex sandbox branches through PR workflow and keeps merged branch/worktree sandboxes for explicit cleanup via `gx cleanup`.
- Runs `gx doctor` repairs from a sandbox when `main` is protected.
- Allows tightly guarded Codex-only commits for `AGENTS.md` / `.gitignore` on protected branches.
- Advanced package version to keep npm publishing unblocked.

### v5.0.0

- Rebranded the CLI to **GuardeX** with `gx`-first command UX.
- Published under scoped package name `@imdeadpool/guardex` to avoid npm name collisions.
- Enforced a repeatable per-message agent branch lifecycle in setup/init flows.
- Added codex-auth-aware sandbox branch naming support.

### v0.4.6

- Added repository metadata (`repository`, `bugs`, `homepage`, `funding`) in package manifest.
- Added CI workflow for Node 18/20/22 with packaging and syntax verification.
- Added npm provenance-oriented release workflow, OpenSSF Scorecard workflow, and Dependabot for Actions.
- Added explicit `SECURITY.md` and `CONTRIBUTING.md`.

### v0.4.5

- Added optional pre-commit behind-threshold sync gate (`multiagent.sync.requireBeforeCommit`, `multiagent.sync.maxBehindCommits`).
- Added `gx sync` workflow (`--check`, sync strategies, report mode).
- `agent-branch-finish.sh` now blocks finishing when source branch is behind `origin/<base>` (config-aware).

### v0.4.4

- Added `scripts/agent-worktree-prune.sh` to templates/install.
- `agent-branch-finish.sh` now auto-runs prune after merge (best effort).
- Added npm helper script: `agent:cleanup`.

### v0.4.2

- Setup now detects existing global OMX/OpenSpec installs first.
- If tools are already present, setup skips global install automatically.
- Interactive approval is strict `[y/n]` (waits for explicit answer).
- Added setup screenshot to README.
- Added workflow screenshots (branch start, lock/delete guard, source-control view).

### v0.4.0

- Added setup-time Y/N approval prompt for optional global install of:
  - `oh-my-codex`
  - `@fission-ai/openspec`
- Added setup flags for automation:
  - `--yes-global-install`
  - `--no-global-install`
- Added official repo links for OMX and OpenSpec.
