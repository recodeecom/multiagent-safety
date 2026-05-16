## Why

- The user asked for the GuardeX frontend tutorial page to match the current How-it-works design and interaction logic used in the main workflow view, while clearly presenting Codex context.
- The existing GuardeX page still used `RECODEE` labels and lacked parity on interaction controls (for example close/reset behavior and keyboard navigation).

## What Changes

- Update `frontend/app/page.tsx` branding surfaces to Codex/GuardeX parity:
  - chat panel label changed to `CHAT • CODEX`,
  - editor label changed to `guardex-agent-work-tree-managment — VS Code`,
  - header subtitle/chips explicitly show GuardeX + Codex flow context.
- Add tutorial interaction parity controls in the GuardeX frontend:
  - close button now resets to execute mode step 1,
  - keyboard shortcuts added (`ArrowLeft`, `ArrowRight`, `Escape`) for step navigation/reset.
- Add matching UI tokens for the new branding chips and close-button hover feedback in `frontend/app/globals.css`.

## Impact

- Affected surface: `guardex-agent-work-tree-managment/frontend` only.
- Risk is low: no backend or API behavior changes; this is a frontend-only parity/UX update.
- Main rollout note: the update relies on existing static tutorial step data and does not introduce new dependencies.
