## Why

- `src/cli/main.js` still carries the protected-main doctor sandbox lifecycle inline even after the earlier parser/dispatch and doctor-foundations passes.
- That keeps sandbox bootstrapping, nested CLI execution, auto-commit, merge-back, lock sync, and output rendering coupled to the top-level CLI file.
- The review surfaced the next highest-value slice clearly: move the doctor lifecycle into its own module and move the remaining generic git helpers out of `main.js`.

## What Changes

- Add `src/doctor/index.js` as the dedicated home for the protected-main `gx doctor` sandbox lifecycle.
- Move the remaining shared branch/config helpers used by that lifecycle into `src/git/index.js`.
- Keep the current CLI surface and doctor output stable while shrinking `src/cli/main.js`.
- Add focused modularization coverage that fails if `main.js` regains local doctor lifecycle ownership.

## Impact

- Primary surface: `gx doctor` on protected branches, especially the sandbox auto-finish + merge-back path.
- Secondary surface: any other CLI path that uses `currentBranchName`, `readGitConfig`, `aheadBehind`, `workingTreeIsDirty`, or `branchMergedIntoBase`.
- Risk is moderate because the doctor flow is behaviorally sensitive, so verification stays focused on doctor and CLI modularization regressions.
