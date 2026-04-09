# musafety

Simple, hardened multi-agent safety setup for any git repo.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

## Install

```sh
npm i -g musafety
```

## Fast setup (recommended)

```sh
# inside your repo
musafety setup
```

That one command runs:

1. install guardrail scripts/hooks,
2. repair common safety problems,
3. scan and report final status.

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
musafety setup [--target <path>] [--dry-run]
musafety copy-prompt
```

No command defaults to `musafety setup`.

## Advanced commands

```sh
musafety install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--dry-run]
musafety fix [--target <path>] [--dry-run] [--keep-stale-locks]
musafety scan [--target <path>] [--json]
```

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
