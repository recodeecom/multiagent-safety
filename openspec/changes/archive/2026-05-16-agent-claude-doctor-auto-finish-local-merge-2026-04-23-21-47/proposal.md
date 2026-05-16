## Why

- `gx doctor` currently disables its `autoFinishReadyAgentBranches` sweep whenever a repo lacks an `origin` remote, a GitHub-flavored origin, or a usable `gh` CLI.
- Repos without a GitHub remote (local mirrors, file-backed remotes, purely local multi-worktree setups) therefore leave agent branches behind after completed work: `gx doctor` reports "skipped auto-finish sweep" and users must run `gx branch finish ... --direct-only` manually per branch.
- The screenshot scenario is common: a parent repo checked out on `main` with a nested agent worktree under `.omc/.omx/agent-worktrees/...`. Users expect `gx doctor` to detect the agent worktree, commit its changes, merge into `main`, and remove the branch + worktree.
- `agent-branch-finish.sh` in `--direct-only --no-push` mode also fails when `BASE_BRANCH` is already checked out in the primary worktree because it tries to `git worktree add` a helper for the same branch.

## What Changes

- Relax `autoFinishReadyAgentBranches` (`src/doctor/index.js`) so the sweep no longer short-circuits when origin / `gh` are unavailable. Instead pick a per-branch fallback:
  - no origin → `--direct-only --no-push --cleanup` (local merge + worktree/branch prune, no push).
  - origin present but not GitHub-flavored or `gh` missing → `--direct-only --cleanup` (local merge + git push).
  - GitHub + `gh` available → existing `--via-pr --cleanup` path (unchanged).
- Teach `agent-branch-finish.sh` (both `scripts/` and `templates/scripts/`) to reuse an already-checked-out base worktree when running in `--direct-only --no-push` mode, so `gx doctor` can merge into `main` without trying to create a second `main` worktree.

## Impact

- Affected runtime surfaces:
  - `src/doctor/index.js` (`autoFinishReadyAgentBranches`)
  - `scripts/agent-branch-finish.sh` and `templates/scripts/agent-branch-finish.sh` (integration-helper branch for local direct mode)
- Affected regression coverage:
  - New case in `test/doctor.test.js` covering the no-origin local fallback.
- Risk is moderate. The doctor sweep behavior change only activates when origin / gh are unavailable, preserving the existing PR-flow path for GitHub repos. The finish-script branch narrows to `MERGE_MODE=direct && PUSH_ENABLED=0`, so existing direct-with-push and PR flows are untouched.
