# Plan Phases: agent-codex-vscode-active-agents-canonical-source-pl-2026-04-22-17-59

One entry per phase. Checkbox marks map to: `x` = completed, `>` = in progress, space = pending.
Indented sub-bullets are optional metadata consumed by the Plans UI:

- `session`: which agent kind runs the phase (`codex` / `claude`).
- `checkpoints`: comma-separated role checkpoint ids delivered within the phase.
- `summary`: one short sentence rendered under the phase title.

One phase is intended to fit into a single Codex or Claude session task.

- [x] [PH01] Audit current Active Agents source-of-truth drift
  - session: codex
  - checkpoints: P1
  - summary: Confirm current main already absorbed the stale runtime/icon follow-ups and isolate the real remaining gap: duplicated authored sources plus missing binary-safe asset propagation.

- [x] [PH02] Choose canonical-source direction and migration boundaries
  - session: codex
  - checkpoints: A1, C1
  - summary: Keep `vscode/guardex-active-agents/` as the authored source of truth and route setup/doctor/materialization through that source instead of manual twin-tree edits.

- [x] [PH03] Implement canonical-source migration
  - session: codex
  - checkpoints: E1
  - summary: Update managed-file resolution, asset copying, and duplicate-tree handling without changing user-visible Active Agents behavior.

- [x] [PH04] Refresh docs and focused regression coverage
  - session: codex
  - checkpoints: W1, V1
  - summary: Replace duplicate-tree parity proofs with canonical-source/install/setup checks and update operator guidance to match the new source path.

- [>] [PH05] Validate and finish the execution lane
  - session: codex
  - checkpoints: E1, V1
  - summary: Run targeted tests plus OpenSpec validation, then finish the implementation branch via PR merge and cleanup.
