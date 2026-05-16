## ADDED Requirements

### Requirement: merged cleanup evidence SHALL be recorded when repo truth is already complete
When a change is already merged and cleaned up, its `tasks.md` SHALL be updated
to reflect that completion evidence instead of remaining falsely incomplete.

#### Scenario: patch stale cleanup checklist after merge
- **GIVEN** `agent-codex-improve-gx-prompt-parts-for-token-usage-2026-04-22-16-05`
  already merged via PR `#318`
- **AND** its original worktree and branch refs are gone
- **WHEN** the OpenSpec artifact is refreshed
- **THEN** its cleanup checklist SHALL be checked
- **AND** the `tasks.md` file SHALL record the PR URL, `MERGED` state, and
  cleanup evidence that matches repo truth.
