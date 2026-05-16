## Why

- The dedicated Active Agents sidebar now owns Guardex session workflows.
- Registering a separate `Active Agents Commit` Source Control provider makes the built-in SCM view noisy and duplicates the real Git repositories operators need there.

## What Changes

- Stop registering the custom `Active Agents Commit` SCM provider.
- Keep the existing Active Agents toolbar commit command, but collect the commit message with a focused VS Code input prompt.
- Update focused tests and README/template copy so Source Control remains reserved for Git repos.

## Impact

- Source Control no longer shows an `Active Agents Commit` section.
- Operators still commit a selected session from the Active Agents toolbar.
