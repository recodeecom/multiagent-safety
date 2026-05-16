## Why

- The user requested the Source Control panel and activity icons to match the visual language used in the "How it works" experience inside this repo.
- The previous Source Control area used simplified text-only rail markers and lower-fidelity change rows, which felt inconsistent with the intended VS Code-like design system.

## What Changes

- Replaced the left activity rail text markers with icon-based controls and active-state affordances aligned with the "How it works" style.
- Added Source Control panel action icons, a live change-count badge, and richer branch/worktree rows.
- Improved file-change row rendering so status markers (`M`, `U`, `D`, `✓`) map to clear color-coded tones.
- Updated Source Control styling (layout, colors, badges, hover/active states, animation) to align with the existing dark VS Code-inspired design direction.

## Impact

- Affected surfaces:
  - `frontend/app/page.tsx`
  - `frontend/app/globals.css`
- Risk is low and isolated to static tutorial UI rendering (no backend/API/runtime behavior changes).
- Rollout requires no migration; changes are immediate on frontend render.
