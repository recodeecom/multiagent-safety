## ADDED Requirements

### Requirement: Frontend subtree mirror sync
The repository SHALL provide an automated mirror flow that updates an external frontend repository from the `frontend/` subtree whenever qualifying changes land on the base branch.

#### Scenario: Sync runs after frontend changes on main
- **WHEN** a commit is pushed to `main` and includes changes under `frontend/**`
- **THEN** the mirror workflow runs
- **AND** it computes a subtree commit from `frontend/`
- **AND** it force-pushes that subtree commit to the configured target repo/branch.

#### Scenario: Manual sync run
- **WHEN** an operator triggers the mirror workflow manually
- **THEN** the workflow syncs the latest `frontend/` subtree to the configured target repo/branch even without a new push event.

#### Scenario: Missing credentials fails closed
- **WHEN** the required mirror push token is missing
- **THEN** the workflow fails with a clear configuration error
- **AND** it does not attempt an anonymous or partial push.
