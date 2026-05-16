## Definition of Done

- Branch `MERGED` on `origin`, PR URL captured.

## 1. Implementation

- [x] 1.1 Add `--no-speckit` / `--speckit` / `--speckit-force` to `parseSetupArgs` in `src/cli/args.js`.
- [x] 1.2 Wire `speckitModule.installSpeckit` into the per-repo loop in `setup()` in `src/cli/main.js`, before the dry-run early-continue.
- [x] 1.3 Gate speckit on `!--no-global-install` to preserve "minimal setup, no external tooling" semantics; allow `--speckit-force` to override.
- [x] 1.4 Add idempotency (`isSpecKitAlreadyInstalled` checks `.specify/integration.json`) and `silent` mode to `installSpeckit` in `src/speckit/index.js`.
- [x] 1.5 Add `--force` / `--reinstall` to standalone `gx speckit`.

## 2. Smoke

- [x] 2.1 `node --check` clean on main.js / args.js / speckit/index.js.
- [x] 2.2 Default `gx setup --dry-run` prints speckit install steps.
- [x] 2.3 `gx setup --dry-run --no-speckit` produces no speckit output.
- [x] 2.4 `gx setup --dry-run --no-global-install` produces no speckit output (auto-gated).
- [x] 2.5 Idempotent: `gx setup --dry-run` on a repo with `.specify/integration.json` prints "already installed".
- [x] 2.6 `node --test test/*.test.js` → 539 pass / 23 fail (matches PR #588 baseline; zero new failures).

## 3. Ship

- [ ] 3.1 Commit + push + PR vs `main` + squash auto-merge.
- [ ] 3.2 Record PR URL + `MERGED` state.
- [ ] 3.3 Confirm sandbox worktree pruned post-merge.
