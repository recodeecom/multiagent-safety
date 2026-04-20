## Why

- The header currently places "How it works" and "GuardeX" side-by-side, which weakens hierarchy.
- The requested layout is a corner-first brand stack: GuardeX/logo in the corner and "How it works" under it.

## What Changes

- Reorder top-left header markup in `frontend/app/page.tsx` so GuardeX appears first and "How it works" appears directly underneath.
- Improve visual weight of the GuardeX logo/title and tighten top-left spacing in `frontend/app/globals.css`.
- Preserve the `guardextutorial.com` tutorial link in the GuardeX subtitle.

## Impact

- Affected surface: frontend tutorial page top bar.
- Risk is low and isolated to top header layout and typography.
