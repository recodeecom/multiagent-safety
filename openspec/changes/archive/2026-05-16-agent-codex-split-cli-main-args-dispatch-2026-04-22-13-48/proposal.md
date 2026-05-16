## Why

- `src/cli/main.js` still carries duplicate parser, git, and dispatch helpers even after the first modularization pass.
- Those duplicate definitions already break the current branch with `SyntaxError: Identifier 'normalizeManagedForcePath' has already been declared`.
- Keeping both copies also preserves behavior drift risk, especially around nested repo discovery and command parsing.

## What Changes

- Make `src/cli/main.js` import the extracted parser, git, and dispatch helpers instead of redefining them locally.
- Keep command behavior stable by moving helper ownership to the existing extracted modules only.
- Add focused regression coverage that fails if `src/cli/main.js` regains local copies of the extracted helpers.

## Impact

- Primary files: `src/cli/main.js`, `src/cli/args.js`, `src/cli/dispatch.js`, `src/git/index.js`, and `test/cli-args-dispatch.test.js`.
- Main risk is accidental behavior drift while deleting local helpers, so verification stays focused on syntax plus representative CLI routes.
