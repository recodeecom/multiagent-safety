## Why

- The README currently mixes three alternative GitHub About descriptions into the product narrative, which adds noise near the top of the page.
- The user requested a single canonical `about_description` source and a clearer visual split between the problem statement and the solution.

## What Changes

- Add a root `about_description.txt` file with the canonical GitHub About copy and point the README at it.
- Move the collision visual under `## The problem` and place the existing branch-start workflow image under `### Solution`.
- Replace the README option dump with a short "GitHub About description" section that mirrors the canonical copy.

## Impact

- Affected surfaces: top-level `README.md`, one new docs image, one new root copy file, and the matching OpenSpec change record.
- Risk is low and limited to docs/rendered README structure.
