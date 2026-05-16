# gitguardex-brand-and-token-budget Specification

## Purpose
TBD - created by archiving change agent-codex-rename-guardex-to-gitguardex-and-slim-fi-2026-04-21-01-29. Update Purpose after archive.
## Requirements
### Requirement: Primary user-facing CLI and skill surface is gitguardex
The system SHALL present `gitguardex` as the primary long-form CLI/skill/command name while keeping `gx` functional.

#### Scenario: setup installs gitguardex skill/command files
- **WHEN** `gx setup` bootstraps a repo
- **THEN** it installs `.codex/skills/gitguardex/SKILL.md`
- **AND** it installs `.claude/commands/gitguardex.md`
- **AND** it does not require the old `guardex` template paths for a healthy install.

### Requirement: Fixed context templates stay lean
The installed multi-agent marker block plus the GitGuardex Codex/Claude command surfaces SHALL stay concise enough to reduce startup token cost versus the prior guardex wording.

#### Scenario: installed templates use compressed wording
- **WHEN** the template files under `templates/AGENTS.multiagent-safety.md`, `templates/codex/skills/gitguardex/SKILL.md`, and `templates/claude/commands/gitguardex.md` are inspected
- **THEN** each file contains only the minimum workflow instructions needed to run the repair/bootstrap flow
- **AND** redundant explanatory paragraphs are absent.

