## ADDED Requirements

### Requirement: Active Agents uses a dedicated sidebar container
The Guardex Active Agents VS Code companion SHALL render its primary tree in a dedicated Activity Bar container instead of contributing the view to the built-in Source Control container.

#### Scenario: Active Agents container ships with branded hive icon
- **WHEN** VS Code loads the extension manifest
- **THEN** the extension contributes a custom Activity Bar container for Active Agents
- **AND** that container references the bundled hive icon asset
- **AND** the `gitguardex.activeAgents` view is registered inside that custom container.

#### Scenario: Focus command opens the Active Agents sidebar
- **WHEN** an operator runs `gitguardex.activeAgents.focus`
- **THEN** the command opens the dedicated Active Agents sidebar container
- **AND** status-bar and tooltip copy refer to Active Agents rather than Source Control.

### Requirement: Active Agents container badge stays truthful
The Guardex Active Agents VS Code companion SHALL keep the live session count badge visible after the view moves into its own Activity Bar container.

#### Scenario: Active sessions show a badge on the sidebar icon
- **WHEN** one or more live Guardex sessions are present
- **THEN** the `TreeView` badge value equals the live session count
- **AND** the new Active Agents container icon surfaces that badge in VS Code.
