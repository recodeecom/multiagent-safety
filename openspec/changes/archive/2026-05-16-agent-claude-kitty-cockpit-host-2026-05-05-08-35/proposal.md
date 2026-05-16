# Kitty cockpit host bootstrap

## Why

`gx cockpit --backend kitty` today only works when the user is already
inside a Kitty window with `allow_remote_control` enabled in
`kitty.conf`. There is no path for `gx cockpit` to spawn its own Kitty
host and tile agent lanes inside it (the dmux-style experience users
expect).

## What changes

- Add `--host` (alias `--bootstrap-kitty`) to `gx cockpit` that spawns a
  detached `kitty` with `allow_remote_control=yes` and a private
  `listen_on=unix:<sock>`.
- Wait for the listen socket to appear, then prepend `--to=unix:<sock>`
  to every `kitty @ launch | focus-window | send-text` issued by the
  cockpit plan so all subsequent panes target the spawned host.
- Add `--socket <path>` to pin a stable listen socket path. Add
  `--no-host` to force the legacy "must already be inside Kitty" mode.
- Bootstrap behavior is opt-in only; `gx cockpit` and `gx cockpit
  --backend kitty` keep their current behavior when `--host` is absent.

## Impact

- New `bootstrapHost()` API on the kitty terminal backend, plus
  `buildKittyHostBootstrapCommand`, `injectRemoteControl`,
  `defaultHostSocketPath`, `socketReady` exports.
- New plan-level `host: { socket }` field and per-command `--to=`
  injection in `src/cockpit/kitty-layout.js`.
- Doc update in `docs/agents-cockpit.md`.
- No change to safety model: branches, worktrees, locks, PR-only
  finish, and cleanup rules are untouched.
