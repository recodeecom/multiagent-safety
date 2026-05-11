# Proposal: Stop Guardex from leaking unrelated dirty files into agent branches; add opt-in safe conflict resolver

## Problem

Two related problems make `gx branch finish` produce PRs that GitHub flags as "branch has conflicts that must be resolved" with files the agent never authored:

1. **Start-side leak.** `scripts/agent-branch-start.sh` runs `git stash push --include-untracked` on a dirty protected-branch checkout and re-applies the entire stash onto the new agent worktree. Anything dirty on the protected branch at start time — local state files (`.omc/project-memory.json`, `.dev-ports.json`, `apps/logs/**`), submodule pointer drift, unrelated WIP — gets transferred into the agent branch. When the agent later opens a PR, those files conflict with `main` because they were never part of the agent's work. PR #3 in a downstream consumer (`Webu-PRO/lifted.sk-backend`) is a concrete instance: its conflict list includes `.omc/project-memory.json`, submodule pointers, and unrelated `.tsx` files. The agent's own PR note documents this verbatim.
2. **Finish-side hard fail.** `scripts/agent-branch-finish.sh` runs a preflight `merge --no-commit --no-ff origin/<base>` to detect base/source drift and exits with `1` on the first conflict. Even when every conflicting file is a state-only file the base should win on, the operator has to resolve and rebase manually.

## Approach

Two layers, both opt-in / safe-by-default.

### Layer 1 — Filter the start-time auto-transfer stash (default ON, conservative)

In `scripts/agent-branch-start.sh`, build the auto-transfer stash with a magic-pathspec exclude list, so canonical state-file paths stay on the protected branch instead of being swept into the agent branch.

- New defaults via `GUARDEX_AUTO_TRANSFER_EXCLUDE` (colon-separated glob list): `.omc/**:.omx/state/**:.dev-ports.json:apps/logs/**:.agents/settings.local.json:.codex/state/**:.claude/state/**`.
- New flags: `--no-transfer` (skip entirely), `--transfer` (force on), `--transfer-exclude <colon:list>` (override the default).
- New env var: `GUARDEX_AUTO_TRANSFER` (`true|false`).
- Globs are passed to `git stash push` as `:/` plus a series of `:(exclude,glob)<pattern>` magic pathspecs, so git does the matching (no shell expansion).
- If after the filter the stash would be empty, the script logs that the local changes were all in the exclude list and proceeds without a transfer.

### Layer 2 — Add opt-in safe conflict resolver to finish (default OFF)

In `scripts/agent-branch-finish.sh`, when `--auto-resolve=safe` is set, the preflight merge no longer hard-fails on conflicts. Instead it walks the conflict list:

- Paths matching `GUARDEX_FINISH_AUTO_RESOLVE_SAFE_GLOBS` (same default list as Layer 1) are resolved via `git checkout --theirs -- <path>` + `git add` (base wins, since the agent isn't authoritative for state).
- Any conflict path **not** in the allowlist immediately aborts the merge and exits non-zero, listing the unresolved files. There is no fallback to ours/theirs for arbitrary code paths.
- Before the resolution commit, the script calls `gx locks claim` on the resolved paths so the pre-commit lock guard does not reject the merge.
- Submodule pointer conflicts are **not** auto-resolved by this change. They require their own handler (deferred to a follow-up change).

### What's explicitly out of scope

- AI-driven resolution of source-code conflicts.
- Submodule pointer auto-resolution.
- Changing the protected-branch lock or other Guardex invariants.

## Rationale

- The PR #3 evidence shows the start-side leak is the root cause of most "branch has conflicts" surprises. Fixing it at the source eliminates the conflict before it ever reaches the PR.
- Submodule pointers and code files cannot share a single resolution policy without producing silent regressions, so we refuse to auto-resolve them in this change.
- `--theirs` on state-only files is safe because those files are gitignored or local-only by contract (`.omc/**`, `.omx/state/**`, etc.) — they should never carry authoritative state out of the agent branch.

## Migration / Compatibility

- All new behavior is gated by either a new flag (`--auto-resolve`, `--no-transfer`) or a default-on conservative exclude list (`AUTO_TRANSFER_EXCLUDE_DEFAULT`).
- Existing callers that depended on the old "transfer everything including state files" behavior can restore it with `GUARDEX_AUTO_TRANSFER_EXCLUDE=` (empty).
- No CLI signatures are removed.
- No git config is required.

## Risks

- The exclude default list is finite — any state-file convention outside the defaults will still leak. Mitigated by the env-var override and PR-visible logging of what was transferred.
- `--auto-resolve=safe` commits an extra merge on the agent branch; users preferring rebase-style history must opt out.
