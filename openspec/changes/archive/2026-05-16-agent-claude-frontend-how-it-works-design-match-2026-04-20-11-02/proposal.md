## Why

The `guardex-agent-work-tree-managment/frontend` tutorial page should match the Claude Design handoff in `recodeeplan/project/How It Works Tutorial.html` pixel-for-pixel so the product story lines up with the design file shipped from claude.ai/design. The existing React scaffold implemented the data model but omitted the VS Code shell chrome, labeled thinking/plan bubbles, tree-view source control, diff gutter, dev-pull animation, and status bar.

## What Changes

- Rewrite `frontend/app/globals.css` to the HTML design tokens (`--vs-*` palette, JetBrains Mono mono track) and layout (flush-edge 100vh shell, 52px top bar, 1fr/1fr panes).
- Rewrite `frontend/app/page.tsx` so each mode's step array declaratively drives:
  - Pane labels (`CHAT · RECODEE`, `VS CODE · LIVE`).
  - VS Code titlebar (traffic lights + project label).
  - Activity bar with live source-control badge.
  - Worktree cards with commit CTA, changes tree view, file-extension badges, and dev-pull animation in the terminal step.
  - File tabs row with close affordance and conflict/resolved states.
  - Code panel with per-line gutter diff markers (`+`/`−`) and a blinking typing caret.
  - Status bar (branch, sync indicator, errors, position, encoding, filetype).
- Add labeled `thinking` (✦) and `plan-list` (□ proposed phases) bubbles plus hint/conflict bubble states.

## Impact

- Affected surfaces: `frontend/app/globals.css`, `frontend/app/page.tsx`.
- Scope is isolated to the How-It-Works tutorial page; no shared components, no public API, no dependency changes (stays on Next 15 / React 19).
- Visual refresh only — the existing mode/step/keyboard navigation behavior is preserved.
- Rollout: ship with the next frontend deploy; no feature flag required. Rollback is a revert of the two files.
