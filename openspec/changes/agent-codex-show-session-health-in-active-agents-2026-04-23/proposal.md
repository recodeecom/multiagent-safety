## Why

- Active Agents already shows state, file churn, and freshness, but it does not surface the per-session health score operators already scan in Cave Monitor.
- When several sandboxes are live, the user has to leave the VS Code tree and cross-check another surface to see which session is drifting hardest.

## What Changes

- Accept an optional `sessionHealth` payload from active-session JSON records and `AGENT.lock` snapshot telemetry.
- Show the compact score (`45/100`) in each session row, with the labeled summary in the tooltip and session detail list.
- Mirror the schema/rendering patch into the extension template and lock it with focused Active Agents tests.

## Impact

- Backward compatible: sessions without `sessionHealth` keep the current description and tooltip format.
- Affected surface: `vscode/guardex-active-agents/*`, `templates/vscode/guardex-active-agents/*`, focused extension tests, and this change workspace.
- This change only renders cave-monitor telemetry when a producer includes it; it does not change how the score is calculated.
