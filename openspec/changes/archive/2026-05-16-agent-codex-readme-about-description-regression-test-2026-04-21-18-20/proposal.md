## Why

- The merged README/about-description update is currently verified by manual inspection and OpenSpec, but not by a focused regression test.
- A narrow metadata test is enough to catch accidental drift in the README section layout or canonical About copy reference.

## What Changes

- Add one metadata test that checks:
  - the collision visual stays under `## The problem`
  - the branch-start visual stays under `### Solution`
  - the README links to `about_description.txt`
  - the canonical About copy in the README matches `about_description.txt`

## Impact

- Affected surface: `test/metadata.test.js` and the matching OpenSpec change docs.
- Risk is low and limited to test coverage.
