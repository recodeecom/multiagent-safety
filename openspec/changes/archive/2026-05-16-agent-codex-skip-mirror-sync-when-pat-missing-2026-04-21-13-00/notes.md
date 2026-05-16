# T1 Notes

- Make the frontend mirror workflow skip cleanly when `GUARDEX_FRONTEND_MIRROR_PAT` is unset instead of failing the whole job.
- Keep the secret wired through `env.SYNC_TOKEN` and gate workflow steps on `env` checks rather than direct `secrets.*` expressions.
- Add a metadata regression so future mirror-link changes keep the skip behavior and the canonical mirror token wiring aligned.
