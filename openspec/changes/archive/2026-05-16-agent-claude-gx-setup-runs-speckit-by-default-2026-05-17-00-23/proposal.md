## Why

- After PR #588, `gx speckit` was an opt-in subcommand. Operators still had to run two commands (`gx setup && gx speckit`) on every fresh repo to get the SDD slash skills wired in. Make speckit part of the default `gx setup` so one command produces the same setup we'd been doing by hand across recodee / colony / polyagent-cli / gitguardex / codex-fleetui.

## What Changes

- `gx setup` now invokes `speckitModule.installSpeckit` per-repo after `runSetupBootstrapInternal` and before the dry-run early exit, so it runs in both dry-run and real modes.
- `installSpeckit` gains:
  - **Idempotency**: short-circuits with `status: 'already-installed'` when `.specify/integration.json` exists, unless `--force/--reinstall` is passed.
  - **Silent mode**: when called from `gx setup`, missing `specify` on PATH or a missing target degrades to a warning + `status: 'skipped'` instead of throwing — setup never fails because of speckit.
- New `parseSetupArgs` flags:
  - `--no-speckit` / `--skip-speckit` — opt out per-invocation.
  - `--speckit` — explicit opt-in (no-op when default is already on).
  - `--speckit-force` / `--reinstall-speckit` — re-run `specify init` even when already installed.
- `--no-global-install` auto-gates speckit too (preserves the existing "minimal setup, no external tooling" semantics relied on by `test/setup.test.js`).
- `gx speckit` subcommand gains the same `--force` / `--reinstall` flag.

## Impact

- New default repo bootstrap: `gx setup` → gx scaffold + cleanup + speckit install in one command.
- No behavior change for repos already running `gx speckit` manually (idempotent skip).
- No new test regressions: full suite still 539 pass / 23 fail (matches PR #588 baseline). `test/setup.test.js` stays 38 pass / 6 fail (the 6 failures are pre-existing).
- `--no-global-install` (used by `test/setup.test.js`) gates speckit out, preserving the minimal-setup invariants.
