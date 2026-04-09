# musafety

[![npm version](https://img.shields.io/npm/v/musafety?color=cb3837&logo=npm)](https://www.npmjs.com/package/musafety)

Simple, hardened multi-agent safety setup for any git repo.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

## Install

```sh
npm i -g musafety
```

Package page: https://www.npmjs.com/package/musafety

Related tools:
- [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)

## Fast setup (recommended)

```sh
# inside your repo
musafety setup
```

That one command runs:

1. asks Y/N approval to install global OMX + OpenSpec tools,
2. installs guardrail scripts/hooks,
3. repairs common safety problems,
4. scans and reports final status.

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

   - When asked "Install global OMX + OpenSpec tools now?" reply:
     - y = run: npm i -g oh-my-codex @fission-ai/openspec
     - n = skip global installs

3) If setup reports warnings/errors, repair + re-check:
   musafety fix
   musafety scan

4) Confirm next safe agent workflow commands:
   bash scripts/agent-branch-start.sh "task" "agent-name"
   python3 scripts/agent-file-locks.py claim --branch "$(git rev-parse --abbrev-ref HEAD)" <file...>
   bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
```

## Basic commands

```sh
musafety setup [--target <path>] [--dry-run] [--yes-global-install|--no-global-install]
musafety copy-prompt
musafety release   # maintainer-only publish (guarded)
```

No command defaults to `musafety setup`.

- Interactive setup: prompts for Y/N approval before global OMX/OpenSpec install.
- Non-interactive setup: skips global installs by default; use `--yes-global-install` to force.

## Advanced commands

```sh
musafety install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--dry-run]
musafety fix [--target <path>] [--dry-run] [--keep-stale-locks]
musafety scan [--target <path>] [--json]
```

## Maintainer release command

`musafety release` is intentionally strict and only runs `npm publish` when all checks pass:

1. current repo root is exactly `/tmp/multiagent-safety`
2. current branch is `main`
3. git working tree is clean

It does **not** bump versions or edit changelog/release notes.

## What is protected

- direct commits to protected branches (`dev`, `main`, `master`)
- overlapping file ownership between agents
- unapproved deletions of claimed files
- risky stale/missing lock state
- accidental loss of critical guardrail files

## Files it installs

```text
scripts/agent-branch-start.sh
scripts/agent-branch-finish.sh
scripts/agent-file-locks.py
scripts/install-agent-git-hooks.sh
.githooks/pre-commit
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

### v0.4.1

- Added `musafety release` (maintainer-only).
- Release command now hard-blocks unless:
  - repo is `/tmp/multiagent-safety`
  - branch is `main`
  - working tree is clean
- Release action is strictly `npm publish` (no version/changelog mutation).

### v0.4.0

- Added setup-time Y/N approval prompt for optional global install of:
  - `oh-my-codex`
  - `@fission-ai/openspec`
- Added setup flags for automation:
  - `--yes-global-install`
  - `--no-global-install`
- Added official repo links for OMX and OpenSpec.
