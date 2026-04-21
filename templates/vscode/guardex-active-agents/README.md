# GitGuardex Active Agents

Local VS Code companion for Guardex-managed repos.

What it does:

- Adds an `Active Agents` view to the Source Control container.
- Renders one row per live Guardex sandbox session.
- Uses VS Code's native animated `loading~spin` icon for the running-state affordance.
- Reads repo-local presence files from `.omx/state/active-sessions/`.

Install from a Guardex-wired repo:

```sh
node scripts/install-vscode-active-agents-extension.js
```

Then reload the VS Code window.
