# /musafety

Run a musafety check-and-repair workflow for the current repository.

## Steps

1. Run `musafety status`.
2. If status is degraded, run `musafety doctor`.
3. If still degraded, run `musafety scan` and summarize each finding with a fix.
4. Report final verdict as one of:
   - `Repo is musafe`
   - `Repo is not musafe` (include blockers)

## Style

- Keep output short and operational.
- Include exact commands you executed.
- Prefer concrete next actions over generic advice.
