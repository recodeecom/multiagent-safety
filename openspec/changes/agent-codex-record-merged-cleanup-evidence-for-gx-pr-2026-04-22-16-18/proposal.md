## Why

- The `gx prompt` token-usage change already landed on `main`, but its
  OpenSpec `tasks.md` still shows the cleanup checklist as incomplete.
- That makes the artifact lie about repo truth even though PR merge, worktree
  cleanup, and branch-ref cleanup all already happened.

## What Changes

- Update the merged change's `tasks.md` cleanup section with the real finish
  evidence for PR `#318`.
- Record the merge state, merged timestamp, and the fact that the original
  worktree plus local/remote refs are now gone.

## Impact

- Scope is limited to OpenSpec documentation.
- No runtime, CLI, or test behavior changes.
- The change reduces false "unfinished" signals in repo artifacts and makes the
  prior completion proof durable.
