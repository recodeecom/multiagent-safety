# Protect Active CWD During Cleanup

## Problem

`gx branch finish --cleanup`, `gx cleanup`, and `gx worktree prune` can be invoked from a process whose real cwd is inside a managed agent worktree while the subprocess that performs cleanup runs from the repo root. In that shape, cleanup can remove the caller's worktree and leave Codex/Claude hooks or skill reloads with `No such file or directory (os error 2)`.

## Change

- Forward the caller cwd into finish and prune subprocesses.
- Treat a worktree as active when the forwarded cwd is inside it, not only equal to the worktree root.
- Preserve the active worktree/branch during cleanup and tell the user to leave that directory before pruning it.

## Verification

- `node --test test/worktree.test.js test/finish.test.js test/metadata.test.js`
