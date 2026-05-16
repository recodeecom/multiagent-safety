## Why

- The managed `.gitignore` block currently lists Guardex-owned `scripts/...` files and `.githooks/...` files one by one. That works, but it is noisy and drifts whenever new bootstrap files land under those directories.
- Users expect `gx setup` / `gx doctor` to ignore the Guardex-managed script surface and the `.githooks` directory as a whole, not a hand-maintained list of individual files.
- Users also expect `AGENTS.md` to come back when Guardex repairs a repo, especially on protected `main` where `gx doctor` has to repair through the sandbox flow.

## What Changes

- `bin/multiagent-safety.js`:
  - Replace the per-file managed `.gitignore` entries for Guardex bootstrap scripts with a single `scripts/*` entry.
  - Replace the per-file managed `.gitignore` entries for git hooks with a single `.githooks` entry.
  - Keep protected-branch doctor auto-finish on the actual protected base branch instead of falling back to the default `dev` base.
- `test/install.test.js`:
  - Update setup assertions to require the wildcard-managed entries instead of the old per-file ignore lines.
  - Extend protected-`main` and nested-repo doctor regressions so they prove `AGENTS.md` is restored and the wildcard `.gitignore` entries are repaired.

## Impact

- **New behavior**: `gx setup` / `gx doctor` write a smaller managed `.gitignore` block with `scripts/*` and `.githooks`.
- **Repair proof**: the regression suite now pins `AGENTS.md` restoration for protected-`main` doctor flow and nested repo doctor flow, alongside the new wildcard ignore entries.
- **Out of scope**: no package version change is needed here because `package.json` and `README.md` are already at `7.0.13`.
