## Why

- `gx cleanup --include-pr-merged` is part of the shipped CLI surface and is exercised by CI.
- The prune script and packaged template dropped explicit `--include-pr-merged` parsing, so cleanup now exits before it can remove squash-merged agent branches.
- Push CI has been red across recent `main` commits because the cleanup regression breaks the unit test matrix before later verification steps run.

## What Changes

- Restore explicit `--include-pr-merged` parsing and merged-PR branch detection in `scripts/agent-worktree-prune.sh`.
- Mirror the same behavior in `templates/scripts/agent-worktree-prune.sh` so installed repos stay in sync with the packaged runtime helpers.
- Keep the existing cleanup CLI/tests aligned so squash-merged agent branches can be pruned again.

## Impact

- Affects Guardex cleanup behavior for explicit PR-merged pruning and the packaged template copy used by setup/repair flows.
- Push CI should return to green once the cleanup regression is removed and the matrix reruns.
