## Why

- The project needs a dedicated frontend demo that visually explains the GuardeX workflow.
- The requested target is a dark, split-screen "How it works" experience similar to the provided reference image.
- A standalone Next.js frontend keeps this UX demo isolated from the CLI package internals.

## What Changes

- Add a new standalone Next.js App Router project under `frontend/`.
- Build a single-page "How it works" interface that includes:
  - top mode controls (`Execute mode`, `Plan mode`, `Merge mode`),
  - a left chat/task panel,
  - a right VS Code-like source control panel,
  - a bottom step/progression control row.
- Implement responsive layout behavior so the two-pane desktop view gracefully stacks on mobile widths.

## Impact

- CLI runtime behavior is unchanged; only a new frontend surface is added.
- New frontend dependencies (`next`, `react`, `react-dom`, TypeScript, Next lint stack) are scoped to `frontend/package.json`.
- Verification must include repository tests and OpenSpec validation; frontend install/build may require an additional dependency install step.
