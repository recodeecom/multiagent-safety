# Proposal: enable OpenSpec scaffolding by default in `gx branch start` and stop the silent-failure log

## Problem

`gx branch start` claims to scaffold the OpenSpec change workspace in its end-of-run log:

```
[agent-branch-start] OpenSpec change: openspec/changes/<slug>
```

But the directory is not created. Reproduced three times this session (PRs #546, #547, #548) — every agent worktree I started had to be manually populated with `proposal.md`/`tasks.md`/`spec.md` despite the log claiming the scaffold was in place.

### Root cause

Two coupled bugs in `templates/scripts/agent-branch-start.sh`:

1. **Default disables scaffolding.** Line 12 reads `OPENSPEC_AUTO_INIT_RAW="${GUARDEX_OPENSPEC_AUTO_INIT:-false}"`. The default is `false`, so the helper `initialize_openspec_change_workspace()` (line 649) hits its guard at line 655 (`if [[ "$OPENSPEC_AUTO_INIT" -ne 1 ]] || [[ "$OPENSPEC_SKIP_CHANGE" -eq 1 ]]; then return 0; fi`) and exits without creating anything. The same gate disables `initialize_openspec_plan_workspace()` at line 629.

2. **Log lines do not check the guard.** Lines 901–911 print "OpenSpec change: openspec/changes/<slug>" only checking `$OPENSPEC_SKIP_CHANGE` (the tier-driven skip), not `$OPENSPEC_AUTO_INIT`. So when AUTO_INIT is 0, the function returns early without printing anything, but the final log still announces the scaffold path as if it had been created.

This contradicts the project's own contract in `CLAUDE.md` (the "Workflow (OpenSpec-first)" section: *"For every repo change (feature, fix, refactor, chore, test, config, docs), create/update an OpenSpec change in `openspec/changes/**` before editing code."*) and contradicts the tier table that describes T2/T3 as creating "full change workspace (`proposal.md`, `tasks.md`, `specs/.../spec.md`)".

## Approach

Two small changes, both in `templates/scripts/agent-branch-start.sh` (the runtime-canonical copy; `scripts/agent-branch-start.sh` is a symlink to it as of PR #548).

1. **Flip the default** at line 12 from `:-false` to `:-true`. Scaffolding is on by default. The downstream `run_guardex_cli internal run-shell changeInit ...` path works correctly — proven in-session by setting `GUARDEX_OPENSPEC_AUTO_INIT=true` once and seeing `proposal.md`, `tasks.md`, `.openspec.yaml`, and `specs/<name>/spec.md` materialize at the worktree's `openspec/changes/<slug>/` path.

2. **Make the end-of-run log honest** at lines 901–911. Each branch of the log now checks `$OPENSPEC_AUTO_INIT` first; if 0, the log says `skipped (GUARDEX_OPENSPEC_AUTO_INIT disabled)`; if 1, it falls through to the existing tier-skip / scaffolded-path branches.

### Out of scope

- Tier policy (T0 skips, T1 minimal, T2/T3 full) — unchanged.
- The `initialize_openspec_change_workspace()` function body — unchanged.
- The scaffolding pipeline downstream (`run-shell changeInit`) — unchanged.
- `scripts/agent-branch-start.sh` — already a symlink to the file we edit (PR #548).

## Rationale

- The OpenSpec contract in `CLAUDE.md` requires a change workspace for every PR. The current default forces every contributor to either set `GUARDEX_OPENSPEC_AUTO_INIT=true` in their environment or manually scaffold by hand — neither is documented. The default should match the contract.
- The downstream pipeline works as soon as the flag is on — verified empirically before committing this fix.
- A misleading log is worse than no log; the new log accurately reports the three real states (auto-init disabled, tier-skipped, scaffolded).

## Compatibility

- Anyone currently relying on the `false` default for some reason (none observed in this repo) can restore it explicitly with `export GUARDEX_OPENSPEC_AUTO_INIT=false`. The negative-path log line clearly tells them what state they're in.
- T0 tier (`gx branch start --tier T0 ...`) still creates no scaffold — `$OPENSPEC_SKIP_CHANGE=1` short-circuits the function regardless of `$OPENSPEC_AUTO_INIT`.
- No CLI surface change. No new flag. No new env var.

## Risks

- Existing CI or fast-iteration scripts that called `bash scripts/agent-branch-start.sh ...` without setting the env var will now create `openspec/changes/<slug>/` directories that they previously didn't. The directories are scoped to the new agent worktree (under `.omc/agent-worktrees/.../openspec/changes/<slug>/`), so they don't pollute the primary checkout. The blast radius is limited to "extra files in throwaway worktrees that get pruned anyway."
- `git status` inside fresh agent worktrees will show one extra directory tracked by the change. This is the intended behavior — those files are the change docs the contract requires.
