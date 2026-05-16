## ADDED Requirements

### Requirement: Canonical frontend mirror links stay aligned
GitGuardex MUST expose `https://github.com/recodeee/gitguardex-frontend` as the canonical standalone frontend repo across public metadata and default mirror configuration.

#### Scenario: Public metadata points at the canonical frontend repo
- **WHEN** maintainers inspect `package.json` homepage metadata or the README frontend mirror section
- **THEN** they see `https://github.com/recodeee/gitguardex-frontend`
- **AND** the older `Webu-PRO/guardex-frontend` target is not presented as the default frontend repo

#### Scenario: Mirror workflow defaults to the canonical frontend repo
- **WHEN** `.github/workflows/sync-frontend-mirror.yml` runs without `GUARDEX_FRONTEND_MIRROR_REPO`
- **THEN** the workflow defaults `TARGET_REPO` to `recodeee/gitguardex-frontend`
