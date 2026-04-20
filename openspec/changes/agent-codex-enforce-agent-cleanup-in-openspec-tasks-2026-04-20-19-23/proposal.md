## Why

- Some consumer repos still scaffold `openspec/changes/<slug>/tasks.md` without any explicit
  cleanup/completion checklist, so agents can stop after verification and skip the required
  PR merge + sandbox cleanup flow.
- `gx doctor` repairs scripts/hooks today, but a stale managed `AGENTS.md` block can remain in
  place, leaving older repo contracts that do not state the cleanup requirement.

## What Changes

- Add mandatory cleanup/completion wording to the canonical multiagent-safety `AGENTS.md`
  snippet and the repo's OpenSpec workflow guidance.
- Extend the OpenSpec change-workspace scaffold so new `tasks.md` files always include a final
  completion section with explicit cleanup, merge-evidence, and blocked-handoff steps.
- Make `gx setup` / `gx doctor` refresh the managed `AGENTS.md` block whenever it drifts from
  the current template, and cover the new behavior with regression tests.

## Impact

- Consumer repos pick up the cleanup requirement on the next `gx setup` / `gx doctor` run.
- Newly scaffolded change tasks guide agents through merge + cleanup instead of leaving that
  flow implicit.
- Managed `AGENTS.md` marker blocks become authoritative repair content, so repo-local edits
  inside the managed block will be replaced by the current template.
