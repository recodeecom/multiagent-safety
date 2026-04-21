## ADDED Requirements

### Requirement: codex-agent skips PR auto-finish for local/file remotes
Guardex SHALL keep `codex-agent` sandbox branches local when the repo only has a local/file-backed `origin` that cannot support a mergeable PR flow.

#### Scenario: fallback sandbox on a local bare origin
- **GIVEN** `scripts/codex-agent.sh` falls back to a direct worktree start
- **AND** the repo `origin` remote resolves to a local path or `file://` URL
- **WHEN** the task run exits successfully
- **THEN** Guardex SHALL skip the PR auto-finish merge/wait path
- **AND** it SHALL keep the sandbox branch/worktree for manual follow-up instead of waiting on merge.

### Requirement: fallback regression accepts the actual owner slug
Focused codex-agent regression coverage SHALL match the branch owner slug emitted by the runtime instead of hardcoding one historical agent family.

#### Scenario: fallback branch is created
- **WHEN** the fallback codex-agent regression runs
- **THEN** it SHALL accept the emitted `agent/<owner>/...` branch prefix
- **AND** it SHALL still verify the local-remote auto-finish skip message and kept-sandbox behavior.
