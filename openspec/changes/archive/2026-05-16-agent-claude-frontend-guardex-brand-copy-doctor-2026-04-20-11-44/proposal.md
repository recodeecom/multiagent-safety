## Why

Follow-up feedback on the How-It-Works page: (a) the Installation mode Step 02 shows a made-up `gx doctor` output instead of the multi-line log users actually see when they run the command locally, (b) the shell tool-call rows in the chat pane can't be copied — users have to retype commands like `npm i -g @imdeadpool/guardex`, `gx setup`, `gx finish --via-pr --wait-for-merge --cleanup` — and (c) the top bar only shows the "How it works" header, leaving no visible product identity for GuardeX itself.

## What Changes

- Replace the synthetic doctor output in Installation Step 02 with a realistic transcript modeled on the actual `gx doctor` run (doctor/fix summary, `hooksPath` set line, `✅ No safety issues detected.`, auto-finish sweep with mixed skip/fail rows, final `✅ Repo is fully safe.`).
- Add per-row copy buttons on every `shell` tool row in the chat pane. Each button copies the row's `value` to the clipboard (navigator.clipboard + `document.execCommand('copy')` fallback), swaps its icon to a green check for ~1.4s, and is keyboard-focusable.
- Add a second brand block to the top bar, to the right of the existing "How it works" header, with its own T-Rex SVG mark, the label "GuardeX", and the tagline "the Guardian T-Rex for your repo". A thin vertical `.brand-divider` separates the two stacks.
- Restyle the GuardeX brand so the tagline reads in accent-green italic, the mark uses a deeper green gradient with a dino silhouette (single inline SVG, no extra assets).

## Impact

- Affected surfaces: `frontend/app/page.tsx`, `frontend/app/globals.css`.
- No dependency changes. Clipboard falls back to `document.execCommand('copy')` for non-secure contexts.
- Visual refresh + one new interactive affordance (row copy). No API surface changes.
- Rollback is a revert of the two files.
