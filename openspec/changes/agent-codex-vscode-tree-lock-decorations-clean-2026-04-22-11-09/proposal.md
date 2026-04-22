## Why

- The Active Agents tree shows live sessions and repo-root changes, but it does not surface lock ownership from `.omx/state/agent-file-locks.json`.
- Operators cannot tell which active session owns how many locks, and repo-root changes can silently overlap a different branch's claimed file.

## What Changes

- Cache the lock registry per repo inside the Active Agents provider.
- Append `🔒 N` to each session row label using the count of locks owned by that session branch.
- Mark repo-root change rows with a warning icon when the file is locked by a different branch than the repo worktree's current branch, and show the owner branch in the tooltip.
- Refresh cached lock state from watcher events on `.omx/state/agent-file-locks.json` instead of re-reading it on every `getChildren()` call.
- Exclude the lock registry file itself from repo-root `CHANGES` rows.

## Impact

- Makes lock ownership visible directly in the VS Code Source Control companion.
- Warns on cross-branch lock conflicts in repo-root changes.
- Keeps tree expansion cheap by moving lock re-reads to file watcher events.
