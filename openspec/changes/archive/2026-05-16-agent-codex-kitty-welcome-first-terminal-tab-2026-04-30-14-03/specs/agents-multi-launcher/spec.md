## ADDED Requirements

### Requirement: Kitty sessions open the gx welcome tab first
Generated Kitty session files for panel-launched agent lanes SHALL open a gx welcome tab before any selected agent terminal tabs.

#### Scenario: Panel launch keeps welcome visible first
- **WHEN** `gx agents start --panel` launches selected agents through Kitty
- **THEN** the generated Kitty session file starts with a `gx welcome` tab rooted at the repo
- **AND** each selected agent lane opens in a later Kitty tab rooted at its worktree
- **AND** the first visible Kitty tab is the gx welcome tab.
