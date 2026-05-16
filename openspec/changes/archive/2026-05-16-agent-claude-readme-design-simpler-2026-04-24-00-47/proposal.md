## Why

- Current `README.md` is 929 lines — too long to land as a first impression on npmjs.com or github.com/recodeee/gitguardex. Reviewers / new users scroll past the install step to reach the value pitch.
- A Claude Design handoff bundle (`claude.ai/design`, file id `sD7EkVZ0h5_9u9LsrWjEDA`) laid out a cleaner narrative: hero → install one-liner → problem → what it does → 4-step workflow → terminal preview → AGENTS.md handling → commands → migration → rough edges.
- The design uses a dark stone-and-moss aesthetic with numbered section chips (`01` … `09`). GitHub markdown can't render the colors / fonts, but the structural ideas (numbered chips, install-first ordering, tight feature list, `before / after` problem table, GFM admonition callouts) translate cleanly.

## What Changes

- **`README.md`**: rewrite top-to-bottom against the design structure.
  - Hero: keep the existing `./logo.png` + shields.io badge row + nav links (reuses the URLs already in the old README so the live badge images don't break).
  - Numbered sections `01`–`09` matching the design file (Install / Problem / What it does / Daily workflow / What `gx` shows first / AGENTS.md / Commands / v6→v7 migration / Known rough edges).
  - Install section narrows to a 3-line code block + the "guard many agent. keep one repo clean." promise + two admonitions (`> [!WARNING]` + `> [!IMPORTANT]`).
  - Problem section uses a 2-column GFM table to mirror the design's before/after diagram.
  - Daily workflow condenses to a 4-col step table + a single bash code block + a `> [!TIP]` admonition.
  - Terminal preview keeps the design's `gx status` snapshot verbatim in a fenced `text` block.
  - AGENTS.md handling = `> [!IMPORTANT]` + 4-row decision table (design verbatim).
  - Commands = 3 compact tables (Core / Lifecycle / Protected branches) — no deep sub-sections.
  - Migration and rough-edges copy verbatim from the design.
- **`package.json`**: bump `@imdeadpool/guardex` 7.0.31 → 7.0.32 so the next `npm publish` ships the new README (README is included in the published tarball via default `files` behavior).

## Impact

- Affected surfaces: `README.md` (rewrite, 929 → ~260 lines) and `package.json` (patch bump).
- No code behavior change. No test or spec impact beyond the OpenSpec artifact for this change.
- Badge URLs preserved so the live shields keep rendering without 404ing on npm / GitHub mirrors.
- Risk: low. Reverting is a single-file git revert on `README.md` + version bump revert.
