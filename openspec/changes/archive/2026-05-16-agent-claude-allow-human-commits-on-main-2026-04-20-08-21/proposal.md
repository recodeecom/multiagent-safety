## Why

- The `.githooks/pre-commit` and `.githooks/pre-push` guards currently block **every** commit/push on a protected branch (`main`/`dev`/`master`), including the human repo owner working from their primary checkout. `.githooks/pre-commit` also auto-reroutes any such commit into a freshly-spawned `agent/auto-reroute/*` worktree, which silently intercepts legitimate human edits (observed: a manual `.gitignore` touch on `main` was redirected).
- The multi-agent safety story only needs to constrain **agents** (Codex / Claude Code / OMX). Humans must retain the ability to commit and push to their primary branch directly.

## What Changes

- Introduce an `is_agent_session` superset variable in both pre-commit hooks and both pre-push hooks. It ORs the existing `CODEX_THREAD_ID`/`OMX_SESSION_ID`/`CODEX_CI` detection with Claude Code's `CLAUDECODE` and `CLAUDE_CODE_SESSION_ID` sentinels (matching the set already used by `.githooks/post-checkout`).
- In the protected-branch block inside both pre-commit hooks, short-circuit with `exit 0` whenever `is_agent_session != 1`. Humans are no longer rerouted, blocked, or funneled through the VS Code opt-in.
- In the pre-push hooks, emit the "Push to protected branch blocked" error only when `is_agent_session == 1`. Humans pass through without needing `multiagent.allowVscodeProtectedBranchWrites`.
- In `templates/githooks/pre-commit`, fix a dead `$is_agent_context` reference (line 158) that would crash under `set -u` — replace with `is_agent_session`.
- Update `test/install.test.js`:
  - `runCmd` now also sanitizes `CLAUDECODE` and `CLAUDE_CODE_SESSION_ID` so host-shell env leakage cannot mark a simulated "human" test as agent.
  - Flip existing "blocks non-codex … on protected branch" assertions to "allows human …" and add new coverage asserting Claude Code sessions (`CLAUDECODE=1`) are still blocked by the protected-branch guard.
- Codex-only messaging and carveouts (`[guardex-preedit-guard] Codex edit/commit detected on a protected branch`, the AGENTS.md/.gitignore managed-only carveout) are unchanged.

## Impact

- **Behavioral**: human commits/pushes on `main`/`dev`/`master` succeed from any terminal without requiring VS Code config. Codex, Claude Code, and OMX are still blocked/rerouted when they attempt direct protected-branch writes.
- **Compat**: Existing overrides (`ALLOW_COMMIT_ON_PROTECTED_BRANCH=1`, `GUARDEX_AUTO_REROUTE_PROTECTED_BRANCH=0`, `multiagent.allowVscodeProtectedBranchWrites`) continue to work. `multiagent.allowVscodeProtectedBranchWrites` becomes a no-op for humans (they already pass) but still exists for backwards compatibility.
- **Surfaces touched**: `.githooks/pre-commit`, `.githooks/pre-push`, `templates/githooks/pre-commit`, `templates/githooks/pre-push`, `test/install.test.js`.
- **Out of scope**: `bin/multiagent-safety.js` (the `setup`/`install`/`doctor` CLI gate on `main` via `protectedBaseWriteBlock`) — separate flow, already honors `--allow-protected-base-write`.
