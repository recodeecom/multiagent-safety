## Why

- `gx setup` is the bootstrap entrypoint, but rerunning it on an already-initialized protected `main` hard-blocks instead of using the safer sandbox path that `gx doctor` already has.
- That makes bootstrap refreshes awkward in exactly the state where users expect Guardex to preserve the visible base checkout.

## What Changes

- Reuse the protected-branch sandbox path for `gx setup` after initialization.
- Sync the managed Guardex bootstrap files back into the protected base workspace after sandboxed setup succeeds.
- Prune the temporary sandbox worktree/branch after the local bootstrap sync completes.
- Add focused regression coverage for protected-`main` setup refresh behavior.

## Impact

- `gx setup` becomes usable as a refresh/bootstrap command on protected `main` without requiring `--allow-protected-base-write`.
- Scope stays limited to managed bootstrap surfaces and targeted setup tests.
