## Why

- `gx setup` recurses into nested repos by default, so operators need a short explicit way to keep a bootstrap or repair run scoped to just the target repo.
- `--no-recursive` already provides that behavior, but users naturally reach for `--current` after learning `gx doctor --current`.
- The current mismatch makes `setup` and `doctor` feel inconsistent even though they share the same repo-traversal model.

## What Changes

- Accept `--current` as a top-level-only alias for repo traversal in `gx setup`.
- Keep `gx doctor --current` working through the same shared traversal parser instead of a command-local special case.
- Update setup-facing operator copy to mention `--current` alongside `--no-recursive`.
- Add a regression proving nested repos under the target path stay untouched when `gx setup --current` is used.

## Impact

- Affected surface: `src/cli/main.js`, `src/context.js`, `test/setup.test.js`, `README.md`.
- Expected outcome: `gx setup --current` and `gx doctor --current` both scope work to the target repo only.
- Risk: low, because the alias reuses the existing non-recursive traversal path.
