# musafety

[![npm version](https://img.shields.io/npm/v/musafety?color=cb3837&logo=npm)](https://www.npmjs.com/package/musafety)
[![CI](https://github.com/recodeecom/multiagent-safety/actions/workflows/ci.yml/badge.svg)](https://github.com/recodeecom/multiagent-safety/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/recodeecom/multiagent-safety/badge)](https://securityscorecards.dev/viewer/?uri=github.com/recodeecom/multiagent-safety)

Simple, hardened multi-agent safety setup for any git repo.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

## Why this tool exists

If you run multiple agents at the same time, it is easy to get collisions:
two agents editing the same files, unsafe deletes, broken branch flow, or
confusing ownership.

`musafety` adds strict guardrails so parallel agent work stays safe and predictable.

![Multi-agent dashboard example](docs/images/dashboard-multi-agent.png)

The dashboard above is the exact kind of parallel workflow this tool is built for.

It also includes an OpenSpec planning scaffold script so plan-mode workspaces
can be bootstrapped consistently across repos.

## Install

```sh
npm i -g musafety
```

Package page: https://www.npmjs.com/package/musafety

## Security + maintenance posture

- CI matrix on Node 18/20/22 (`npm test`, `node --check`, `npm pack --dry-run`)
- trusted publishing workflow uses `npm publish --provenance` in GitHub Actions
- OpenSSF Scorecard workflow and weekly Dependabot for GitHub Actions
- Dedicated security disclosure policy in [`SECURITY.md`](./SECURITY.md)

Related tools:
- [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)

## Fast setup (recommended)

```sh
# inside your repo
musafety setup
```

That one command runs:

1. detects whether OMX/OpenSpec are already globally installed,
2. asks strict Y/N approval only if something is missing,
3. installs guardrail scripts/hooks,
4. repairs common safety problems,
5. installs local Codex + Claude musafety helper skill files if missing,
6. scans and reports final status.

## Setup screenshot

![musafety setup success screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/setup-success.svg)

## Status logs screenshot

![musafety status command logs screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/status-tools-logs.svg)

## AI helper skills installed by setup/doctor

`musafety setup` and `musafety doctor` also ensure these local helper files exist:

- Codex skill: `.codex/skills/musafety/SKILL.md`
- Claude command: `.claude/commands/musafety.md` (use as `/musafety`)

## Workflow protocol screenshots

### 1) Start isolated agent branch/worktree

![musafety branch start protocol screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/workflow-branch-start.svg)

### 2) Lock claim + deletion guard protocol

![musafety lock and delete guard screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/workflow-lock-guard.svg)

### 3) Multi-agent branch visibility (IDE/source control style)

![musafety source control multi-agent screenshot](https://raw.githubusercontent.com/recodeecom/multiagent-safety/main/docs/images/workflow-source-control.svg)

## Copy prompt for your AI (Codex / Claude)

```sh
musafety copy-prompt
```

This prints a ready-to-paste prompt. Example output:

```text
Use this exact checklist to setup multi-agent safety in this repository for Codex or Claude.

1) Install (if missing):
   npm i -g musafety

2) Bootstrap safety in this repo:
   musafety setup

   - Setup detects global OMX/OpenSpec first.
   - If one is missing and setup asks for approval, reply explicitly:
     - y = run: npm i -g oh-my-codex @fission-ai/openspec (missing ones only)
     - n = skip global installs

3) If setup reports warnings/errors, repair + re-check:
   musafety doctor

4) Confirm next safe agent workflow commands:
   bash scripts/agent-branch-start.sh "task" "agent-name"
   python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
   bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"

5) Optional: create OpenSpec planning workspace:
   bash scripts/openspec/init-plan-workspace.sh "<plan-slug>"

6) Optional: protect extra branches:
   musafety protect add release staging

7) Optional: sync your current agent branch with latest dev:
   musafety sync --check
   musafety sync
```

## Basic commands

```sh
musafety status [--target <path>] [--json]
musafety setup [--target <path>] [--dry-run] [--yes-global-install|--no-global-install] [--no-gitignore]
musafety doctor [--target <path>] [--dry-run] [--json] [--keep-stale-locks] [--no-gitignore]
musafety copy-prompt
musafety protect list [--target <path>]
musafety protect add <branch...> [--target <path>]
musafety protect remove <branch...> [--target <path>]
musafety protect set <branch...> [--target <path>]
musafety protect reset [--target <path>]
musafety sync --check [--target <path>] [--base <branch>] [--json]
musafety sync [--target <path>] [--base <branch>] [--strategy rebase|merge] [--ff-only]
bash scripts/agent-worktree-prune.sh --base dev   # manual stale worktree cleanup
bash scripts/openspec/init-plan-workspace.sh <plan-slug>   # optional OpenSpec plan scaffold
```

No command defaults to `musafety status` (non-mutating health/status view).
`musafety status` reports CLI/runtime info, global OMX/OpenSpec service status, and repo safety service state.
When run in an interactive terminal, default `musafety` checks npm for a newer version first
and asks `[Y/n]` whether to update immediately (default is `Y`).

- Interactive setup: prompts for Y/N approval before global OMX/OpenSpec install.
- Interactive prompt is strict (`[y/n]`) and waits for explicit answer.
- Non-interactive setup: skips global installs by default; use `--yes-global-install` to force.

## Advanced commands

```sh
musafety install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--no-gitignore] [--dry-run]
musafety fix [--target <path>] [--dry-run] [--keep-stale-locks] [--no-gitignore]
musafety scan [--target <path>] [--json]
```

## Keep agent branches synced with dev

Use sync checks before finishing agent branches:

```sh
musafety sync --check
musafety sync
```

Defaults:
- base branch: `dev` (or `multiagent.baseBranch`)
- strategy: `rebase` (or `multiagent.sync.strategy`)

Useful variants:

```sh
musafety sync --strategy merge
musafety sync --all-agent-branches --check
```

By default, `agent-branch-finish.sh` also blocks finishing when your branch is behind `origin/<base>` and points to `musafety sync`.

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
musafety protect list
musafety protect add release staging
musafety protect remove dev
musafety protect set main release hotfix
musafety protect reset
```

Configuration is stored in local git config key:

```text
multiagent.protectedBranches
```

## What is protected

- direct commits to protected branches (defaults: `dev`, `main`, `master`; configurable via `musafety protect ...`)
- protected-branch commits are blocked regardless of commit client (including VS Code Source Control)
- overlapping file ownership between agents
- unapproved deletions of claimed files
- risky stale/missing lock state
- accidental loss of critical guardrail files
- setup also writes a managed `.gitignore` block so generated musafety scripts/hooks stay out of normal git status noise by default
  - pass `--no-gitignore` if you want to keep tracking these files in git

## Files it installs

```text
scripts/agent-branch-start.sh
scripts/agent-branch-finish.sh
scripts/agent-worktree-prune.sh
scripts/agent-file-locks.py
scripts/install-agent-git-hooks.sh
scripts/openspec/init-plan-workspace.sh
.githooks/pre-commit
.codex/skills/musafety/SKILL.md
.claude/commands/musafety.md
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
- Added `musafety sync` workflow (`--check`, sync strategies, report mode).
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
