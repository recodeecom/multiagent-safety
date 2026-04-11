# /guardex

Run a GuardeX check-and-repair workflow for the current repository.

## Steps

1. Run `gx status`.
2. If status is degraded, run `gx doctor`.
3. If still degraded, run `gx scan` and summarize each finding with a fix.
4. Report final verdict as one of:
   - `Repo is guarded`
   - `Repo is not guarded` (include blockers)

## Style

- Keep output short and operational.
- Include exact commands you executed.
- Prefer concrete next actions over generic advice.
