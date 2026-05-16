## ADDED Requirements

### Requirement: Active Agents local installs use a canonical extension directory
The Active Agents install flow SHALL publish the companion into one canonical local VS Code extension directory instead of making the newest versioned patch directory the only live copy.

#### Scenario: Installer refreshes the canonical install path
- **WHEN** `scripts/install-vscode-active-agents-extension.js` installs the companion
- **THEN** it writes the current extension payload into a stable local extension directory derived from the extension id
- **AND** that directory contains the current manifest, runtime entrypoint, session schema, and packaged assets
- **AND** focused regression coverage validates the installed payload.

### Requirement: Recent patch-version install paths stay loadable until reload
The Active Agents install flow SHALL keep recent same-major/minor patch-version install paths resolvable so already-open VS Code windows do not lose the companion because an older cached location was pruned before reload.

#### Scenario: Installer refreshes compatibility copies for recent patch paths
- **WHEN** the current companion version is `X.Y.Z`
- **THEN** the installer refreshes compatibility directories for a bounded recent patch window within `X.Y.*`
- **AND** the current patch-version directory stays loadable
- **AND** already-open windows that still point at a recent earlier patch path can continue resolving the extension until the window reloads.

### Requirement: Install output tells users to reload already-open windows
The Active Agents install flow SHALL tell the user that every already-open VS Code window needs a reload after install or auto-update.

#### Scenario: Install completes successfully
- **WHEN** the installer finishes copying the companion
- **THEN** stdout includes the installed version and canonical target directory
- **AND** stdout explicitly tells the user to reload each already-open VS Code window to pick up the newest companion.
