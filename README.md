# GuardeX — Guardian T-Rex for your repo

[![npm version](https://img.shields.io/npm/v/%40imdeadpool%2Fguardex?color=cb3837&logo=npm)](https://www.npmjs.com/package/@imdeadpool/guardex)
[![CI](https://github.com/recodeecom/multiagent-safety/actions/workflows/ci.yml/badge.svg)](https://github.com/recodeecom/multiagent-safety/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/recodeecom/multiagent-safety/badge)](https://securityscorecards.dev/viewer/?uri=github.com/recodeecom/multiagent-safety)

GuardeX is a short-command, hardened multi-agent safety setup for any git repo.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

## Why this tool exists

If you run multiple agents at the same time, it is easy to get collisions:
two agents editing the same files, unsafe deletes, broken branch flow, or
confusing ownership.

`GuardeX` adds strict guardrails so parallel agent work stays safe and predictable.

![Multi-agent dashboard example](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/dashboard-multi-agent.png)

The dashboard above is the exact kind of parallel workflow GuardeX is built for.

It also includes an OpenSpec planning scaffold script so plan-mode workspaces
can be bootstrapped consistently across repos.

## Install

```sh
npm i -g @imdeadpool/guardex
```

Package page: https://www.npmjs.com/package/@imdeadpool/guardex


## Command aliases

- Preferred short command: `gx`
- Full command: `guardex`
- Legacy aliases still supported: `musafety`, `multiagent-safety`

## Security + maintenance posture

- CI matrix on Node 18/20/22 (`npm test`, `node --check`, `npm pack --dry-run`)
- trusted publishing workflow uses `npm publish --provenance` in GitHub Actions
- OpenSSF Scorecard workflow and weekly Dependabot for GitHub Actions
- Dedicated security disclosure policy in [`SECURITY.md`](./SECURITY.md)

Related tools:

- [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [codex-account-switcher-cli](https://github.com/recodeecom/codex-account-switcher-cli)

## Fast setup (recommended)

```sh
# inside your repo
gx setup
# alias:
gx init
```

That one command runs:

1. detects whether OMX/OpenSpec/codex-auth are already globally installed,
2. asks strict Y/N approval only if something is missing,
3. installs guardrail scripts/hooks,
4. repairs common safety problems,
5. installs local Codex + Claude gx helper skill files if missing,
6. scans and reports final status.

## Setup behavior screenshot

![gx status/setup behavior screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/setup-success.svg)

## Status logs screenshot

![gx service status screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/guardex-service-status.svg)

## AI helper skills installed by setup/doctor

`gx setup` and `gx doctor` also ensure these local helper files exist:

- Codex skill: `.codex/skills/guardex/SKILL.md`
- Claude command: `.claude/commands/guardex.md` (use as `/guardex`)

## Scorecard report generation

Create/update markdown reports from OpenSSF Scorecard JSON:

```sh
gx report scorecard --repo github.com/recodeecom/multiagent-safety
```

By default this writes:

- `docs/reports/openssf-scorecard-baseline-YYYY-MM-DD.md`
- `docs/reports/openssf-scorecard-remediation-plan-YYYY-MM-DD.md`

## Workflow protocol screenshots

### 1) Start isolated agent branch/worktree

![gx branch start protocol screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/workflow-branch-start.svg)

### 2) Lock claim + deletion guard protocol

![gx lock and delete guard screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/workflow-lock-guard.svg)

### 3) Multi-agent branch visibility (IDE/source control style)

![gx source control multi-agent screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/workflow-source-control.svg)

#### Real VS Code Source Control example (after `gx setup`)

![GuardeX real VS Code Source Control layout](./docs/images/workflow-vscode-guardex-real.png)

This is the exact layout you should expect in VS Code Source Control after setup
and a few `agent-branch-start` runs:

```text
GuardeX (your preferred local branch: main/dev)
agent_codex_<snapshot>-<task>
agent_bot_<snapshot>-<task>
agent_bot_<snapshot>-<task>-2
```

That gives you one stable main repo view plus parallel agent worktrees in the
same VS Code window, so branch ownership and progress stay visible at once.

## Companion tool: `codex-auth` account switcher

If you run multiple Codex identities, this workflow pairs well with
[`codex-auth`](https://github.com/recodeecom/codex-account-switcher-cli/tree/main),
a CLI that snapshots `~/.codex/auth.json` per account and lets you switch fast
without repeated login/logout loops.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

How `codex-auth` works:

- stores named snapshots in `~/.codex/accounts/*.json`
- switches by replacing active `~/.codex/auth.json`
- keeps lightweight per-terminal session memory (default key is shell PPID),
  so older terminals can keep their original account context

Requirements: Node.js 18+

Install:

```sh
npm i -g @imdeadpool/codex-account-switcher
```

Common commands:

```sh
codex-auth login [name]
codex-auth save <name>
codex-auth use <name>
codex-auth list --details
codex-auth current
codex-auth status
codex-auth self-update --check
```

Optional shell-hook helpers:

```sh
codex-auth setup-login-hook
codex-auth hook-status
codex-auth remove-login-hook
```

## Copy prompt for your AI (Codex / Claude)

```sh
gx copy-prompt
```

This prints a ready-to-paste prompt.

### Prompt preview (SVG)

![gx copy prompt screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/copy-prompt-output.svg)

### Commands-only copy mode

If you only want executable commands (without explanatory text):

```sh
gx copy-commands
```

Example output:

```sh
npm i -g @imdeadpool/guardex
gx setup
gx doctor
bash scripts/codex-agent.sh "task" "agent-name"
bash scripts/agent-branch-start.sh "task" "agent-name"
python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"
gx protect add release staging
gx sync --check
gx sync
```

Full checklist output:

```text
Use this exact checklist to setup multi-agent safety in this repository for Codex or Claude.

1) Install (if missing):
   npm i -g @imdeadpool/guardex

2) Bootstrap safety in this repo:
   gx setup
   # alias: gx init

   - Setup detects global OMX/OpenSpec/codex-auth first.
   - If one is missing and setup asks for approval, reply explicitly:
     - y = run: npm i -g oh-my-codex @fission-ai/openspec @imdeadpool/codex-account-switcher (missing ones only)
     - n = skip global installs

3) If setup reports warnings/errors, repair + re-check:
   gx doctor

4) Confirm next safe agent workflow commands:
   bash scripts/codex-agent.sh "task" "agent-name"
   bash scripts/agent-branch-start.sh "task" "agent-name"
   python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
   bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
   - For every new user message/task, repeat the same cycle:
     start isolated agent branch/worktree -> claim file locks -> implement/verify ->
     finish via PR/merge cleanup with scripts/agent-branch-finish.sh.
   - `scripts/codex-agent.sh` now auto-runs this finish flow after Codex exits:
     auto-commit changed files -> push/create PR -> merge attempt -> keep branch/worktree for follow-up.
   - Remove merged branches when you are done reviewing:
     gx cleanup --branch "$(git rev-parse --abbrev-ref HEAD)"

5) Optional: create OpenSpec planning workspace:
   bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"

6) Optional: protect extra branches:
   gx protect add release staging

7) Optional: sync your current agent branch with latest base branch:
   gx sync --check
   gx sync

8) Optional (GitHub remote cleanup): enable:
   Settings -> General -> Pull Requests -> Automatically delete head branches
```

## Basic commands

```sh
gx status [--target <path>] [--json]
gx setup [--target <path>] [--dry-run] [--yes-global-install|--no-global-install] [--no-gitignore] [--allow-protected-base-write]
gx init [--target <path>] [--dry-run] [--yes-global-install|--no-global-install] [--no-gitignore] [--allow-protected-base-write]
gx doctor [--target <path>] [--dry-run] [--json] [--keep-stale-locks] [--no-gitignore] [--allow-protected-base-write]
gx copy-prompt
gx copy-commands
gx protect list [--target <path>]
gx protect add <branch...> [--target <path>]
gx protect remove <branch...> [--target <path>]
gx protect set <branch...> [--target <path>]
gx protect reset [--target <path>]
gx sync --check [--target <path>] [--base <branch>] [--json]
gx sync [--target <path>] [--base <branch>] [--strategy rebase|merge] [--ff-only]
gx cleanup [--target <path>] [--base <branch>] [--branch <agent/...>] [--dry-run] [--force-dirty] [--keep-remote]
gx report scorecard [--target <path>] [--repo github.com/<owner>/<repo>] [--scorecard-json <file>] [--output-dir <path>] [--date YYYY-MM-DD]
bash scripts/agent-worktree-prune.sh   # prune temporary worktrees only (keeps merged agent branches by default)
bash scripts/agent-worktree-prune.sh --delete-branches --delete-remote-branches   # full merged-branch cleanup
bash scripts/agent-worktree-prune.sh --force-dirty --delete-branches   # force-remove dirty merged worktrees too
bash scripts/openspec/init-plan-workspace.sh <plan-slug>   # optional OpenSpec plan scaffold
```

No command defaults to `gx status` (non-mutating health/status view).
`gx status` reports CLI/runtime info, global OMX/OpenSpec/codex-auth service status, and repo safety service state.
`gx init` is an alias of `gx setup`.
When run in an interactive terminal, default `GuardeX` checks npm for a newer version first
and asks `[y/N]` whether to update immediately (default is `N`).

- Interactive setup: prompts for Y/N approval before global OMX/OpenSpec/codex-auth install.
- Interactive prompt is strict (`[y/n]`) and waits for explicit answer.
- Non-interactive setup: skips global installs by default; use `--yes-global-install` to force.
- In already-initialized repos, `setup` / `install` / `fix` block writes on protected `main` by default; start an agent branch first. Use `--allow-protected-base-write` only for emergency in-place maintenance.
- `gx doctor` on protected `main` auto-starts an isolated `agent/gx/...-gx-doctor` worktree branch and applies repairs there.
  It also syncs repaired `.omx/state/agent-file-locks.json` back to your protected workspace so stale-lock warnings clear immediately.
- `gx setup` and `gx doctor` always refresh `.githooks/pre-commit` from templates, so Codex sub-branch enforcement stays repaired.
- `scripts/codex-agent.sh` now auto-runs finish automation after a Codex session when `origin` exists:
  auto-commit changed files, run PR/merge automation, and keep merged agent branches/worktrees by default.
  It also auto-syncs each sandbox branch against the latest base branch before task execution.
  If conflicts remain, it keeps the sandbox and prompts for a conflict-resolution review pass.
- use `gx cleanup` (or `gx cleanup --branch <agent/...>`) to remove merged branches/worktrees when done.

## Advanced commands

```sh
gx install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--no-gitignore] [--dry-run] [--allow-protected-base-write]
gx fix [--target <path>] [--dry-run] [--keep-stale-locks] [--no-gitignore] [--allow-protected-base-write]
gx scan [--target <path>] [--json]
gx report help
```

## Keep agent branches synced with your base branch

Use sync checks before finishing agent branches:

```sh
gx sync --check
gx sync
```

Defaults:

- `gx sync` base branch: `dev` (or `multiagent.baseBranch`)
- strategy: `rebase` (or `multiagent.sync.strategy`)

`agent-branch-start.sh` and `agent-branch-finish.sh` resolve base branch in this order:

1. explicit `--base`
2. `multiagent.baseBranch`
3. branch-linked base metadata / source upstream / current checked-out branch (context-dependent)
4. fallback `dev`

Useful variants:

```sh
gx sync --strategy merge
gx sync --all-agent-branches --check
```

By default, `agent-branch-finish.sh` also blocks finishing when your branch is behind `origin/<base>` and points to `gx sync`.

Optional pre-commit behind-threshold gate (off by default):

```sh
git config multiagent.sync.requireBeforeCommit true
git config multiagent.sync.maxBehindCommits 0
```

With that enabled, agent-branch commits are blocked if the branch is behind `origin/<base>` by more than the configured threshold.

## Configure protected branches

Default protected branches are:

- `dev`
- `main`
- `master`

You can manage additional protected branches via CLI:

```sh
gx protect list
gx protect add release staging
gx protect remove dev
gx protect set main release hotfix
gx protect reset
```

Configuration is stored in local git config key:

```text
multiagent.protectedBranches
```

## What is protected

- direct commits to protected branches (defaults: `dev`, `main`, `master`; configurable via `gx protect ...`)
- protected-branch commits are blocked by default for all clients; Codex sessions only may commit protected branches when staged files are strictly `AGENTS.md` and/or `.gitignore`
- Codex-session commits on non-`agent/*` branches are blocked by default (`multiagent.codexRequireAgentBranch=true`)
- Codex commits attempted on protected branches trigger `guardex-preedit-guard` and require starting work via `scripts/codex-agent.sh`
- overlapping file ownership between agents
- unapproved deletions of claimed files
- risky stale/missing lock state
- accidental loss of critical guardrail files
- in-place branch bootstrap requires explicit opt-in (`--in-place --allow-in-place`)
- setup also writes a managed `.gitignore` block so generated gx scripts/hooks stay out of normal git status noise by default
  - includes `oh-my-codex/` by default to keep local OMX source clones out of repo status
  - pass `--no-gitignore` if you want to keep tracking these files in git

## Files it installs

```text
scripts/agent-branch-start.sh
scripts/agent-branch-finish.sh
scripts/codex-agent.sh
scripts/agent-worktree-prune.sh
scripts/agent-file-locks.py
scripts/install-agent-git-hooks.sh
scripts/openspec/init-plan-workspace.sh
.githooks/pre-commit
.codex/skills/guardex/SKILL.md
.claude/commands/guardex.md
.omx/state/agent-file-locks.json
```

If `package.json` exists, it also adds helper scripts (`agent:*`).

## Local development

```sh
npm test
node --check bin/multiagent-safety.js
npm pack --dry-run
```

## Release notes

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
- Interactive approval is now strict `[y/n]` (waits for explicit answer).
- Added setup screenshot to README.
- Added 3 additional workflow screenshots (branch start, lock/delete guard, source-control view).

### v0.4.0

- Added setup-time Y/N approval prompt for optional global install of:
  - `oh-my-codex`
  - `@fission-ai/openspec`
- Added setup flags for automation:
  - `--yes-global-install`
  - `--no-global-install`
- Added official repo links for OMX and OpenSpec.
