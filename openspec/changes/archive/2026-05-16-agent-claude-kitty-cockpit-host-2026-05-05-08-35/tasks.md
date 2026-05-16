# Tasks

## 1. Spec
- [x] 1.1 Capture proposal in `proposal.md`
- [x] 1.2 Capture spec delta in `specs/cockpit-kitty-layout/spec.md`

## 2. Tests
- [x] 2.1 Add `test/cockpit-kitty-bootstrap.test.js` covering
       `injectRemoteControl`, `buildKittyHostBootstrapCommand`,
       `openKittyCockpit({ bootstrap: true })` plan injection, and
       `parseCockpitArgs` for `--host` / `--socket` / `--no-host`.
- [x] 2.2 Verify existing kitty/cockpit tests still pass
       (`cockpit-kitty-layout`, `cockpit-kitty-integration`,
       `cockpit-terminal-backend`).

## 3. Implementation
- [x] 3.1 Add bootstrap helpers to `src/terminal/kitty.js`
       (`buildKittyHostBootstrapCommand`, `bootstrapHost`,
       `injectRemoteControl`, `defaultHostSocketPath`, `socketReady`).
- [x] 3.2 Wire `bootstrap` / `socket` / `host` plumbing into
       `src/cockpit/kitty-layout.js` `openKittyCockpit`, plus
       `injectRemoteControlIntoPlan` to prepend `--to=` per command.
- [x] 3.3 Add `--host`, `--bootstrap-kitty`, `--no-host`, and
       `--socket` to `parseCockpitArgs` in `src/cockpit/index.js` and
       thread them through `openWithBackend` to `openKittyCockpit`.
- [x] 3.4 Update `docs/agents-cockpit.md` with a `--host` section and
       correct the default-backend description (`auto`, not `tmux`).

## 4. Cleanup
- [x] 4.1 Commit changes on the agent branch.
- [x] 4.2 Push branch and open a PR.
- [x] 4.3 Run `gx branch finish ... --via-pr --wait-for-merge --cleanup`.
- [x] 4.4 Record PR URL and `MERGED` evidence.
