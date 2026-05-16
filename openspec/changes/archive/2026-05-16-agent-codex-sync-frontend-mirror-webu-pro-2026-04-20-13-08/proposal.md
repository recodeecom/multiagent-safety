## Why

- The user requested that updates to the `frontend/` app in this repository also update `https://github.com/Webu-PRO/guardex-frontend`.
- The current workflow does not automatically publish frontend subtree updates to that external repository.

## What Changes

- Add an automated GitHub Actions workflow that mirrors the `frontend/` subtree to a configurable target repository.
- Add a local shell helper script for the subtree-sync push logic so workflow behavior is explicit and reusable.
- Document required repository secrets/variables and manual trigger behavior in `README.md`.

## Impact

- Affected surface: CI automation (`.github/workflows`) and documentation; no runtime behavior change for `gx`.
- Operational requirement: a repository secret with push access to `Webu-PRO/guardex-frontend`.
- Risk is moderate: mirror push is force-updated by subtree commit to keep target repo exactly aligned with `frontend/`.
