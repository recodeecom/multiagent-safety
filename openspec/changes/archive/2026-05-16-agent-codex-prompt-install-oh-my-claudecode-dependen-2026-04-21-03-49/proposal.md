## Why

- `gx status` still surfaces the Claude companion by its npm package name `oh-my-claude-sisyphus`, which is not the user-facing project/repo name.
- When that companion is inactive, Guardex does not clearly tell the user that the missing dependency maps to the `oh-my-claudecode` repository.
- If the user declines companion installation, setup currently skips without an explicit dependency warning.

## What Changes

- Present the Claude companion as `oh-my-claudecode` in human-facing status output and JSON service metadata while preserving `oh-my-claude-sisyphus` as the underlying npm package name.
- When the Claude companion is inactive, print the upstream repository dependency URL so the user sees what Guardex expects.
- When companion installation is skipped by prompt choice or `--no-global-install`, print a warning that the `oh-my-claudecode` dependency remains inactive.
- Bump the package to the next patch version and record the shipped change in the README release notes so npm publish can succeed after `7.0.12` was already taken.

## Impact

- Human-facing setup/status output becomes clearer for Claude companion installs.
- Existing npm install behavior stays intact; only the presentation and skipped-install warning path change.
- The release metadata matches the next publishable npm version.
