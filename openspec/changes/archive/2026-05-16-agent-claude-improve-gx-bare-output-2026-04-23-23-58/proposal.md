## Why

- `gx` (no args) dumps 20+ lines every run: an 8-line global-services block, a repo-safety block, and the full `gitguardex-tools logs:` tree (USAGE / QUICKSTART / COMMANDS / AGENT BOT / REPO TOGGLE) on every invocation.
- The banner renders the same static `Try 'gitguardex doctor' for one-step repair + verification.` regardless of the actual repo state — agent branches, stalled worktrees, and clean dev all get identical wording.
- Branding is inconsistent: the banner mixes `[gitguardex]` prefixes with a `gitguardex-tools logs:` title while the user typed `gx`, and the internal label `-tools logs` leaks through to users.
- Stalled / in-progress agent worktrees under `.omc/agent-worktrees/` and `.omx/agent-worktrees/` are invisible to `gx` unless the user separately runs `gx doctor` or the session-start hook.

## What Changes

- **`src/cli/main.js` `status(...)`**:
  - Add `--verbose` / `GUARDEX_VERBOSE_STATUS` to force the expanded output and `GUARDEX_COMPACT_STATUS` to force compact.
  - Collapse `Global services:` to `N/N ● active` when stdout is a TTY, every service is active, and neither forceExpand nor forceCompact overrides the decision.
  - Count live agent worktrees under `.omc/agent-worktrees` + `.omx/agent-worktrees` via a filesystem-cheap `fs.readdirSync` call (no subprocess).
  - Emit a one-line `[gitguardex] ⚠ N active agent worktree(s) → <invoked> finish --all` nudge when the count > 0.
  - Emit a `[gitguardex] Next: …` hint derived from cheap signals (branch name, worktree count, guardex toggle, scan errors/warnings).
- **`src/output/index.js` `printToolLogsSummary(options)`**:
  - New `{ invokedBasename, compact }` options. `compact: true` skips the full tree and prints a single help pointer.
  - Replace the `<TOOL_NAME>-tools logs:` title with `<invoked> help:` so the section label matches the command name the user typed.
  - Thread the invoked basename into the closing `Try '<invoked> doctor' …` line, and use the same basename inside `usage(...)` so `gx help` / `gitguardex help` stay self-consistent.
- **`getInvokedCliName()` helper**: normalize `process.argv[1]` basename to the closest known CLI name (`gx` / `gitguardex` / `guardex`), falling back to `SHORT_TOOL_NAME` for test harnesses invoking `bin/multiagent-safety.js` directly.
- **`test/status.test.js`**: replace the `gitguardex-tools logs:` / flat-COMMANDS assertions with `gx help:` + grouped `Setup & health` assertions, add regressions for compact mode (`GUARDEX_COMPACT_STATUS=1`) and for `--verbose` forcing the expanded list back on.

## Impact

- Affected runtime surfaces:
  - `src/cli/main.js` — new helpers `countAgentWorktrees` / `deriveNextStepHint`, refactored `status(...)` flow for the three scan paths (no git repo / disabled / active or degraded), all three paths now emit `[gitguardex] Next: …` before the help tree.
  - `src/output/index.js` — new `getInvokedCliName` helper exported, `printToolLogsSummary` signature change (no external callers outside this repo), `usage()` now takes an optional `invokedBasename` and uses it in the USAGE / NOTES block.
- Affected regression coverage:
  - `test/status.test.js` — updated banner expectations + two new tests for compact / verbose modes.
- Risk is low. No behavior change for tools that parse `status --json`; JSON payload is unchanged. Human-readable text is compact by default in interactive TTYs and falls back to the expanded (current) layout whenever stdout is piped, any service is inactive, or `--verbose` / `GUARDEX_VERBOSE_STATUS` is set — which preserves the output CI/scripts already rely on.
