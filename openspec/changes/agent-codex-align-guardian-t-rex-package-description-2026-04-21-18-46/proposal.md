## Why

- `about_description.txt` and the README already use the approved Guardian T-Rex positioning, but `package.json` still exposes the older generic package description.
- That drift makes the npm package metadata tell a different story than the canonical About copy.

## What Changes

- Align `package.json` `description` with the canonical text in `about_description.txt`.
- Restore the README GitHub About section so the canonical copy is visible and linked from the documented source file.
- Restore the missing README solution visual required by the current `readme-about-description` regression.
- Add an OpenSpec delta that requires package metadata to stay aligned with the canonical About description source.

## Impact

- Affected surfaces: `package.json`, `README.md`, one metadata regression test, and the matching OpenSpec change record.
- Risk is low and limited to package metadata / product copy consistency.
