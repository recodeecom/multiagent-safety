## Why

- `gx setup` installs OpenSpec helper scripts that are older than the live `recodee` copies already guiding current work.
- The published `gitguardex` AGENTS contract already promises tier-aware OpenSpec scaffolding, but the installed helper scripts still miss the richer change and plan workspace behavior.
- Downstream repos bootstrapped with `gx setup` should get the same OpenSpec workspace shape that `recodee` is already using.

## What Changes

- Sync the published `init-change-workspace.sh` helper to the richer `recodee` version, including:
  - T1/minimal notes-only change scaffolding support
  - stronger cleanup and Definition-of-Done guidance in `tasks.md`
  - optional agent-branch placeholder support for manual scaffolds
- Sync the published `init-plan-workspace.sh` helper to the richer `recodee` version, including:
  - coordinator, kickoff, and phases artifacts
  - per-role OpenSpec proposal/spec/task scaffolds
  - stronger ExecPlan and checkpoint prompts
- Keep runtime/template copies aligned and expand regression coverage for the richer scaffold outputs.

## Impact

- Affected surface: `gx setup` / `gx doctor` managed OpenSpec helper scripts plus their runtime/template parity tests.
- User-facing effect: new repos bootstrapped with Guardex get the same richer OpenSpec workspace shape already present in `recodee`.
- Risk: low-to-moderate because the change is limited to scaffold content, but stale tests would hide drift if they are not updated together.
