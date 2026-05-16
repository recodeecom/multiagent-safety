# Add startup file claims to `gx agents start`

## Problem

Agent lane startup can create the branch/worktree, but callers cannot pre-claim the files they already know the lane will edit. Agents must run a second command and can miss the ownership step.

## Scope

- Parse repeated `--claim <path>` flags on `gx agents start <task> --agent <name>`.
- After branch/worktree creation, claim the requested files for the created branch.
- Preserve existing repo-bot `gx agents start --target <repo>` behavior.
- Mark startup session state as `claim-failed` and print recovery commands when claims fail.

