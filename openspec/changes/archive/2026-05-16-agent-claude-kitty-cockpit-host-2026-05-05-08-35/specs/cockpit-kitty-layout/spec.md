## ADDED Requirements

### Requirement: gx cockpit can spawn its own Kitty host
`gx cockpit` SHALL accept a `--host` flag (alias `--bootstrap-kitty`)
that spawns a detached `kitty` process configured with
`allow_remote_control=yes` and a private `listen_on=unix:<sock>`, then
targets all subsequent remote-control commands at that socket.

#### Scenario: --host bootstraps a fresh Kitty window
- **WHEN** `gx cockpit --host` is invoked
- **THEN** the process spawns `kitty` with
  `-o allow_remote_control=yes -o listen_on=unix:<sock>` and
  `--directory <repo-root>`
- **AND** waits for `<sock>` to exist before issuing any
  `kitty @ launch | focus-window | send-text` commands
- **AND** prepends `--to=unix:<sock>` to every cockpit plan command
  argument list.

#### Scenario: --socket pins a stable listen path
- **WHEN** `gx cockpit --host --socket /tmp/gx-cockpit.sock` is invoked
- **THEN** the spawned host listens on `/tmp/gx-cockpit.sock`
- **AND** every plan command targets that socket via `--to=`.

#### Scenario: --no-host preserves legacy behavior
- **WHEN** `gx cockpit --no-host` is invoked
- **THEN** no fresh Kitty host is spawned
- **AND** plan commands carry no `--to=` argument
- **AND** the cockpit assumes the parent shell is already inside a
  Kitty session with remote control enabled.

#### Scenario: Bootstrap is opt-in
- **WHEN** `gx cockpit` runs with no host-related flag
- **THEN** the cockpit behaves exactly as before this change
- **AND** no `--to=` argument is injected by default.

### Requirement: Kitty backend exposes a host bootstrap API
The Kitty terminal backend SHALL expose a `bootstrapHost(options)`
method, a `buildKittyHostBootstrapCommand` builder, and an
`injectRemoteControl(args, socket)` helper so callers can spawn a
fresh Kitty host and route remote-control traffic to it.

#### Scenario: bootstrapHost returns socket and pid
- **WHEN** `kittyBackend.bootstrapHost({ repoRoot, socket })` is invoked
- **THEN** it spawns kitty with allow_remote_control + listen_on
- **AND** returns `{ action: 'bootstrap-kitty-host', socket, listenOn,
  pid, command }` once the socket is ready.

#### Scenario: injectRemoteControl is idempotent
- **WHEN** an args list already contains `--to=...`
- **THEN** `injectRemoteControl` returns the args unchanged
- **AND** non-`@` argument lists (e.g. `['--version']`) are returned
  unchanged.
