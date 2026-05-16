## ADDED Requirements

### Requirement: Active Agents does not register a Source Control commit provider
The Guardex Active Agents VS Code companion SHALL NOT register a custom Source Control provider or native SCM input for Active Agents commits.

#### Scenario: Extension loads with Source Control open
- **WHEN** VS Code activates the `gitguardex.activeAgents` companion
- **THEN** the companion does not call `vscode.scm.createSourceControl` for Active Agents
- **AND** the built-in Source Control view does not show an `Active Agents Commit` section.

### Requirement: Selected-session commit command prompts outside Source Control
The Guardex Active Agents VS Code companion SHALL keep the selected-session commit command available from the Active Agents view without requiring an SCM input box.

#### Scenario: Header command commits selected session worktree
- **WHEN** the operator selects a live Active Agents session and activates `gitguardex.activeAgents.commitSelectedSession`
- **THEN** the companion prompts for a commit message
- **AND** it stages the selected session worktree with `git add -A`
- **AND** it excludes `.omx/state/agent-file-locks.json` from that stage operation
- **AND** it runs `git commit -m <message>` against the selected session's `worktreePath`.

#### Scenario: Missing selection degrades safely
- **WHEN** the operator activates `gitguardex.activeAgents.commitSelectedSession` without a selected session
- **THEN** the companion does not prompt for a commit message
- **AND** it shows an information message telling the operator to pick a session first.
