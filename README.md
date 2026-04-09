# multiagent-safety

A command-line tool that installs a hardened multi-agent collaboration safety workflow into any git repository.

> [!WARNING]
> Not affiliated with OpenAI or Codex. Not an official tool.

## How it Works

`multiagent-safety` installs the same core protections used in real multi-agent repos:

1. **Protected branch guard** blocks direct commits on `dev`, `main`, and `master`.
2. **Agent branch lifecycle scripts** enforce branch/worktree isolation and safe merge-back.
3. **File ownership locks** stop overlapping edits across agents.
4. **Delete approvals** require explicit per-file opt-in before deleting claimed files.
5. **Safety scan** audits the repo for stale locks, missing guardrail files, and risky state.

This keeps agents from accidentally deleting each other's logic or removing Codex guardrails.

## Requirements

- Node.js 18+
- Git
- Python 3 (for `agent-file-locks.py`)

## Install (npm)

```sh
npm i -g multiagent-safety
```

## Usage

```sh
# install workflow into current repository
multiagent-safety install

# scan current repository for safety issues
multiagent-safety scan

# install or scan another repository
multiagent-safety install --target /path/to/repo
multiagent-safety scan --target /path/to/repo

# print only AGENTS snippet
multiagent-safety print-agents-snippet
```

Running `multiagent-safety` with no command defaults to `install`.

## Install options

```sh
multiagent-safety install [--target <path>] [--force] [--skip-agents] [--skip-package-json] [--dry-run]
```

- `--target <path>`: target repo path (default: current directory)
- `--force`: overwrite existing managed files when content differs
- `--skip-agents`: do not create/update `AGENTS.md`
- `--skip-package-json`: do not inject helper npm scripts
- `--dry-run`: preview actions without writing files

## Scan options

```sh
multiagent-safety scan [--target <path>] [--json]
```

- `--target <path>`: repo path to audit
- `--json`: machine-readable findings output

Scan exit codes:

- `0` = clean
- `1` = warnings (non-fatal issues)
- `2` = errors (high-risk / broken safety setup)

## What gets added to the target repo

```text
scripts/agent-branch-start.sh
scripts/agent-branch-finish.sh
scripts/agent-file-locks.py
scripts/install-agent-git-hooks.sh
.githooks/pre-commit
.omx/state/agent-file-locks.json
```

If `package.json` exists, these scripts are added/updated:

- `agent:branch:start`
- `agent:branch:finish`
- `agent:hooks:install`
- `agent:locks:claim`
- `agent:locks:allow-delete`
- `agent:locks:release`
- `agent:locks:status`

Installer also configures:

```sh
git config core.hooksPath .githooks
```

## Recommended workflow inside an installed repo

```sh
# 1) Start isolated agent branch/worktree
bash scripts/agent-branch-start.sh "task-name" "agent-name"

# 2) Claim ownership before edits
python3 scripts/agent-file-locks.py claim \
  --branch "$(git rev-parse --abbrev-ref HEAD)" \
  path/to/file1 path/to/file2

# 3) If you intentionally need to delete a claimed file
python3 scripts/agent-file-locks.py allow-delete \
  --branch "$(git rev-parse --abbrev-ref HEAD)" \
  path/to/file1

# 4) Validate / inspect lock state
python3 scripts/agent-file-locks.py status
multiagent-safety scan

# 5) Finish and merge back safely
bash scripts/agent-branch-finish.sh --branch "$(git rev-parse --abbrev-ref HEAD)"
```

## Local development

```sh
npm test
node --check bin/multiagent-safety.js
npm pack --dry-run
```
