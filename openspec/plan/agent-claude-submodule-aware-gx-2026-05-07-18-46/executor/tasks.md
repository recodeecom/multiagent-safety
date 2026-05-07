# executor tasks — submodule-aware gx

> **Role goal**: implement the spec exactly. Author tests first,
> then code. Claim every file before edit. Do not expand scope.

## Scope boundary

In scope:
- `scripts/agent-submodules.py` (new)
- `scripts/agent-branch-start.sh` (extend; do not rewrite)
- `scripts/agent-branch-finish.sh` (extend; do not rewrite)
- `scripts/agent-file-locks.py` (extend lock-record format)
- `scripts/codex-agent.sh` (only if it surfaces submodule state)
- new tests under `test/agent-submodules-*`
- minimal CLI surface in `bin/gx`

Out of scope:
- frontend / cockpit changes
- Rust runtime
- README / AGENTS.md prose (writer)
- merge gate logic for parent PR (already exists)

## 1. Spec
- [ ] 1.1 Re-read `specs/gitguardex-submodules/spec.md` and the
       proposal before any edits.
- [ ] 1.2 Claim every file you intend to touch:
       `gx locks claim --branch <branch> <file...>`. Note the
       claim is per `(submodule_root, relative_path)` after the
       lock-format change ships, so claim with the new format
       last (chicken-and-egg: bootstrap with the bare-path format
       once, then migrate).

## 2. Tests
- [ ] 2.1 Write `test/agent-submodules-detect.test.js` first;
       confirm it fails before implementing detection.
- [ ] 2.2 Write `test/agent-submodules-locks.test.py`; confirm it
       fails before implementing tuple keying.
- [ ] 2.3 Write `test/agent-submodules-finish.test.js`; uses a
       throwaway fixture repo with two fixture submodules.
- [ ] 2.4 Write `test/agent-submodules-preflight.test.js`; mocks
       `api.github.com/repos/...` via a stub HTTP client.

## 3. Implementation
- [ ] 3.1 Implement `agent-submodules.py` (`parse_gitmodules`,
       `submodule_status`, `classify`, `manifest_for_branch`,
       `preflight_token`, `init_in_worktree`).
- [ ] 3.2 Wire `init_in_worktree` into `agent-branch-start.sh`
       after worktree creation; persist manifest to
       `.guardex/submodules.json` inside the worktree.
- [ ] 3.3 Migrate `agent-file-locks.py` to tuple keys; preserve
       legacy-entry read path.
- [ ] 3.4 Wire the per-submodule write loop and atomic gitlink
       bump into `agent-branch-finish.sh`. Reuse the existing
       `--wait-for-merge` poller; do not duplicate it.
- [ ] 3.5 Add `gx submodules status` and `gx submodules
       preflight` to `bin/gx`.
- [ ] 3.6 Run the full test suite: `npm test` (Node tests) and
       `python3 -m pytest test/` (if pytest is installed) or
       `python3 -m unittest discover test/` as a fallback.

## 4. Checkpoints
- [ ] 4.1 Checkpoint after detection + manifest land.
- [ ] 4.2 Checkpoint after lock migration lands.
- [ ] 4.3 Checkpoint after atomic gitlink bump lands and the
       fixture E2E test passes.

## Handoff fields

```
branch=agent/claude/submodule-aware-gx-2026-05-07-18-46
task=executor
blocker=<failing test|missing API|unclaimed file>
next=critic | verifier
evidence=<test command output>, <PR URL>
```
