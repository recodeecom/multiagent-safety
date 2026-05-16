## Why

Claude Code (and Codex) sessions could not recover from a protected-branch
mutation block on their own. The PreToolUse `skill_guard` hook blocks `Edit`,
`Write`, and most `Bash` mutations on `dev`/`main`/`master`, and the documented
escape was to set `ALLOW_BASH_ON_NON_AGENT_BRANCH=1` /
`ALLOW_CODE_EDIT_ON_PROTECTED_BRANCH=1` in the harness env. AI agents cannot
mutate harness env from inside a tool call, so they were forced to stop and ask
the user to run shell commands manually — every time the human pivoted between
`main`/`dev` and an agent branch, or wanted Claude to keep going across a
PR/merge cycle.

The whitelist also rejected safe sync ops (`git pull --ff-only`, `git stash
list`, agent-only `git push`, `gh pr create/merge`, and direct `gx`
subcommands), which made even pure-read recovery commands fail.

## What Changes

- Widen `SHELL_ALLOWED_SEGMENTS` in `.claude/hooks/skill_guard.py` and
  `.codex/hooks/skill_guard.py` to allow:
  - `git pull` / `git pull --ff-only [...]` / `git pull --rebase [...]` (safe
    fast-forward sync of the protected branch the user is on).
  - `git stash list` and `git stash show` (read-only stash inspection).
  - `git push [origin] agent/...` and `git push HEAD:agent/...` (only the
    `agent/*` ref namespace is permitted from primary).
  - The full `gh pr` / `gh issue` / `gh workflow` action surface (PR ops are
    safe — they affect remote, not local files).
  - Any `gx` / `guardex` / `gitguardex` / `multiagent-safety` subcommand (the
    CLI itself enforces guardrails internally).
  - Direct invocation of `scripts/agent-branch-finish.sh` and
    `scripts/agent-pivot.sh`.
- Update both `BLOCKED` messages (`ensure_protected_branch_edit_allowed`,
  `ensure_non_agent_shell_command_allowed`) to point Claude at a single
  copy-pastable command (`gx pivot "<task>" "<agent-name>"`) that does the
  whole hop — branch + worktree creation, dirty-tree migration, and a clean
  machine-parseable trailer (`WORKTREE_PATH=...`, `BRANCH=...`, `NEXT_STEP=cd
  "..."`) the agent can parse to know exactly where to `cd`.
- Add `gx pivot "<task>" "<agent>" [--tier T0|T1|T2|T3]`. On a protected
  branch, it forwards to `agent-branch-start.sh` (which already migrates dirty
  changes), then echoes the trailer. On an existing `agent/*` branch it
  short-circuits with the current worktree path — safe to call as a no-op.
- Add `gx ship` — alias for `gx finish --via-pr --wait-for-merge --cleanup`,
  injecting any of those flags the caller forgot. Encodes the
  "Default Claude finish (non-negotiable)" rule from `AGENTS.md` so AI agents
  cannot accidentally strand commits or worktrees.

## Impact

- Affects: PreToolUse hook regex + block messages (Claude + Codex variants),
  `gx` CLI dispatch (new `pivot` and `ship` subcommands), help output, and
  command-suggestion list.
- Risk: hook regex change is additive — it only widens the allow list. No
  previously-allowed command becomes blocked. New writable patterns
  (`git pull --ff-only`, `git push origin agent/...`, `gh pr create/merge`,
  `gx <subcommand>`) are scoped so they cannot mutate protected branches
  directly.
- Rollout: ship as a normal `gx` patch release; downstream repos pick the
  hook change up via `gx setup --repair` (hooks live under `.claude/hooks/`
  and `.codex/hooks/`, not in templates yet — follow-up: copy-on-setup).
- Coverage: new `test/pivot.test.js` covers protected-branch -> agent
  worktree pivot and the existing-worktree short-circuit. Whitelist regex is
  exercised inline by a Python self-test.
