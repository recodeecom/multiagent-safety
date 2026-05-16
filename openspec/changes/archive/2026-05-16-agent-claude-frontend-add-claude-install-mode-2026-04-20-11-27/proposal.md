## Why

The How-It-Works tutorial currently demos two Codex sessions running in parallel and hides how a user installs GuardeX in the first place. Follow-up feedback asked for (a) a visible `npm i -g @imdeadpool/guardex` install command that can be copied from the header, (b) a parallel lane that shows Claude and Codex coexisting (not Codex twice), and (c) an end-to-end Installation walkthrough as a fourth mode after Merge mode.

## What Changes

- Add `INSTALL_COMMAND = 'npm i -g @imdeadpool/guardex'` and render it as a copyable install pill in the top bar (uses `navigator.clipboard`, falls back to `document.execCommand('copy')`, swaps icon to `check` for 1.6s while showing a "copied" toast).
- Extend `ModeKey` and `MODE_ORDER` with `installation` and register `INSTALL_STEPS` — a 5-step walkthrough (install → `gx doctor` audit → `gx setup` scaffold → `gx start` sandbox → `gx finish` PR + cleanup with dev-pull animation on the final step).
- Update Execute mode Step 06/07 so the second parallel worktree is `agent_claude__projects-hydration-mismatch-sidebar` (branch `agent/claude/...`), labelled `claude · parallel`, with copy that names Claude running alongside Codex.
- Extend `ModeConfig.dotClass` with `'i'` and add the blue `.dotc.i` accent in CSS.
- Add `.install-pill` styles (surface background, `$` dollar accent, hover/focus/copied states, "copied" toast).
- Add a `copy` icon to the icon set.

## Impact

- Affected surfaces: `frontend/app/page.tsx`, `frontend/app/globals.css` only.
- No dependency changes; clipboard has a `document.execCommand('copy')` fallback so the pill still works under older browsers / non-secure contexts.
- No API surface changes. Visual refresh plus a new (optional) fourth mode in the top segmented control.
- Rollback is a revert of the two files.
