## Why

Multi-agent `gx agents start` already creates isolated `agent/*` lanes, but the recent launcher panel still points operators back through cockpit/tmux for terminal panes. The requested operator flow needs the safety model to stay unchanged while opening the created lanes in a Kitty window by default.

## What Changes

- Add a Kitty-backed terminal launcher for multi-agent starts.
- Add `--terminal kitty|none` with `GUARDEX_AGENT_TERMINAL` defaulting to `kitty`.
- Keep branch/worktree creation, lock claiming, and PR finish flow unchanged.
- Update launcher panel terminal copy to Kitty-first language.

## Impact

- Multi-agent starts can open one Kitty session after all lanes are created.
- Missing Kitty reports a recovery command and session file path instead of failing lane creation.
- `--terminal none` keeps the old no-terminal behavior.
