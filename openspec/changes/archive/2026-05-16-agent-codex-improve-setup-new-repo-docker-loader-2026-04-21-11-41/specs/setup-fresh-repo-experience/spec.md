## ADDED Requirements

### Requirement: fresh repo setup onboarding
Guardex setup SHALL tell the user what to do next when the target repo has not been committed or published yet.

#### Scenario: unborn branch bootstrap
- **WHEN** the user runs `gx setup` in a repo whose current branch has no commits yet
- **THEN** the setup scan output shows the actual unborn branch name instead of `(unknown)`
- **AND** the setup success output includes a bootstrap-commit hint
- **AND** the setup success output includes the first agent branch -> lock claim -> finish flow for that repo

#### Scenario: setup on repo without origin
- **WHEN** the target repo has no `origin` remote
- **THEN** the setup success output explains that finish and auto-merge flows remain local until a remote is added

### Requirement: docker compose loader bootstrap
Guardex setup SHALL install a repo-local Docker compose loader helper and surface it when compose files are present.

#### Scenario: setup scaffolds docker loader
- **WHEN** the user runs `gx setup`
- **THEN** the repo contains an executable `scripts/guardex-docker-loader.sh`
- **AND** `package.json` includes `agent:docker:load`

#### Scenario: compose repo gets docker hint
- **WHEN** the target repo contains a compose file such as `docker-compose.yml` or `compose.yaml`
- **THEN** the setup success output mentions `scripts/guardex-docker-loader.sh`
- **AND** the output tells the user to set `GUARDEX_DOCKER_SERVICE`
