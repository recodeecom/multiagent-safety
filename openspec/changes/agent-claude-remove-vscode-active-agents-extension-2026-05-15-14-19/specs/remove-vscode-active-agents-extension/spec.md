## REMOVED Requirements

### Requirement: Optional VS Code active-agents extension install prompt
`gx setup` MUST NOT prompt to install the `Recodee.gitguardex-active-agents` VS Code extension, MUST NOT honor `GUARDEX_SKIP_VSCODE_EXT_PROMPT`, and MUST NOT shell out to `code --install-extension` as part of setup. The extension source under `vscode/guardex-active-agents/` and its `templates/vscode/` mirror SHALL NOT ship with the package.

### Requirement: Agent session-state heartbeat helper
The CLI MUST NOT expose `gx internal heartbeat` or `gx internal stop-session` subcommands, MUST NOT register a `sessionState` entry in `PACKAGE_SCRIPT_ASSETS`, and MUST NOT scaffold `scripts/agent-session-state.js` into managed repos. The `templates/scripts/codex-agent.sh` launcher MUST NOT record, refresh, or terminate active-session state and MUST NOT run a background heartbeat loop for the duration of the codex CLI subprocess.

### Requirement: VS Code extension destination path mapping
`src/context.js#toDestinationPath` MUST NOT accept relative template paths beginning with `vscode/`. Any caller passing such a path is treated as an unsupported template and the function throws.
