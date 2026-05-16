## Why

- The shipped Active Agents companion lives inside Source Control, so it competes with the repo graph and SCM surfaces instead of giving agents their own lane.
- Operators need a dedicated Activity Bar icon with a count badge so active sandboxes stay visible at a glance without taking over the SCM container.

## What Changes

- Move the `gitguardex.activeAgents` view into a dedicated Activity Bar container with a hive-style icon.
- Keep the existing tree-based runtime badge wiring so the new container shows the live active-agent count on its icon.
- Update focus text, extension copy, mirrored template assets, and focused regression coverage for the new sidebar location.

## Impact

- Affected surfaces: `vscode/guardex-active-agents/*`, `templates/vscode/guardex-active-agents/*`, `test/vscode-active-agents-session-state.test.js`, `README.md`, and this change workspace.
- Risk is narrow because the runtime tree data stays the same; the change is mainly manifest placement, icon assets, and focus-copy alignment.
