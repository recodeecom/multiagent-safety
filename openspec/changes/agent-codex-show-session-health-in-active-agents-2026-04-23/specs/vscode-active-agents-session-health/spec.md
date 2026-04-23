## ADDED Requirements

### Requirement: Active Agents rows surface optional session health
The VS Code Active Agents extension SHALL show the compact session-health score when an active-session record or `AGENT.lock` telemetry payload includes Cave Monitor health data for that session.

#### Scenario: Active-session record includes session health
- **GIVEN** `.omx/state/active-sessions/<branch>.json` contains `sessionHealth.score=45` and `sessionHealth.label="Inefficient"`
- **WHEN** the extension renders that session in `Working now` or `Idle / thinking`
- **THEN** the row description includes `45/100`
- **AND** the tooltip or session detail list includes `45/100 · Inefficient`

#### Scenario: Worktree lock fallback includes session health
- **GIVEN** no active-session JSON exists for a managed worktree
- **AND** the worktree `AGENT.lock` snapshot telemetry includes session health for the latest session preview
- **WHEN** the extension falls back to the `AGENT.lock` session
- **THEN** the rendered session row includes the compact `score/100`
- **AND** sessions without `sessionHealth` keep the current description format.
