## Why

- `origin/main` already absorbed the earlier branch-start/finish and doctor parity fixes, but one `codex-agent` fallback regression still remains.
- When `codex-agent` falls back to a direct worktree start in repos whose `origin` is only a local/file remote, it still tries the PR auto-finish path and waits on a merge surface that does not exist.

## What Changes

- Make `scripts/codex-agent.sh` and its install template skip PR auto-finish when the repo only has a local/file-backed `origin`, keeping the sandbox branch/worktree instead of entering `--wait-for-merge`.
- Keep the fallback regression coverage aligned with the actual branch-owner slug emitted by the runtime instead of hardcoding `agent/codex/...`.

## Impact

- Affected runtime surfaces:
  - `scripts/codex-agent.sh`
  - `templates/scripts/codex-agent.sh`
- Affected regression coverage:
  - `test/install.test.js`
- Risk is narrow and limited to local-remote `codex-agent` auto-finish detection plus fallback test expectation parity.
