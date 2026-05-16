## Why

- `gx setup` and `gx doctor` currently fail with a raw `ENOTDIR` when a target repo contains a `.codex` file instead of a `.codex/` directory.
- On a fresh repo, Guardex also writes the managed `.gitignore` block too late, so a partial bootstrap can leave a noisy-looking working tree before the install aborts.

## What Changes

- Detect file-vs-directory path conflicts during template installation and throw a Guardex-specific error that explains the blocking path and the fix.
- Write the managed `.gitignore` block before scaffolding directories and templates in both setup and doctor/fix paths.
- Add regression coverage for the `.codex` file conflict so both `setup` and `doctor` fail clearly while still creating `.gitignore`.

## Impact

- Affected surfaces:
  - `bin/multiagent-safety.js`
  - `test/install.test.js`
- Risk is low and scoped to repo bootstrap/repair flows.
- No change to steady-state runtime behavior after a successful install.
