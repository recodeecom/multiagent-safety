## Why

- `gx status` reports every global toolchain package we rely on (`oh-my-codex`, `@fission-ai/openspec`, `@imdeadpool/codex-account-switcher`, `gh`) as active/inactive. The Claude-side mirror of `oh-my-codex` — the npm package `oh-my-claude` (currently v1.0.5 on the registry) — is not checked, so users who rely on it get no signal from `gx` when it is missing or outdated.
- `gx setup` writes a managed `.gitignore` block that includes `.omx/` so codex runtime state (notepad, state dir, logs, agent worktrees) stays out of commits by default. A sibling `.omc/` root is planned for Claude-specific worktrees and state (follow-up change); shipping the gitignore entry now keeps downstream repos future-proof against accidental commits when that routing lands.

## What Changes

- `bin/multiagent-safety.js`:
  - Append `'oh-my-claude'` to `GLOBAL_TOOLCHAIN_PACKAGES`. `gx status` now reports it alongside the existing four services using the same active/inactive detection via `npm ls -g`.
  - Append `'.omc/'` to `MANAGED_GITIGNORE_PATHS` immediately after `'.omx/'`. `gx setup` / `gx doctor --repair` now writes a `.omc/` entry into the managed block of `.gitignore`.
- `test/install.test.js`: extend the managed-`.gitignore` assertion suite with a check that `.omc/` is present in the written block.
- `package.json`: bump `7.0.4` → `7.0.5`.
- `README.md`: add a `### v7.0.5` release-notes entry describing both additions.

## Impact

- **New behavior**: `gx status` output grows by one service line. `gx setup` on a repo without an existing managed block writes `.omc/` into the produced `.gitignore`; repos with an existing managed block get `.omc/` added on next `gx setup`/`gx doctor --repair`.
- **Compat**: No existing files are re-formatted; the entry appears in the same marker-delimited section as `.omx/`. Downstream repos that were already gitignoring `.omc/` manually will see no effective change.
- **Out of scope**: routing Claude worktrees into `.omc/agent-worktrees/` and fanning out worktree discovery across both roots — that's a separate change (discovery call-site survey required per advisor note).
- **Surfaces touched**: `bin/multiagent-safety.js`, `test/install.test.js`, `package.json`, `README.md`.
