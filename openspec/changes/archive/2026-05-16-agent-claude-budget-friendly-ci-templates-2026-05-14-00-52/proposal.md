## Why

Gitguardex agent flows (`gx branch start` lanes) land high-volume PRs per month. Every PR currently fans out across CI, CodeQL, Scorecard, and AI Code Review with no skip mechanism, which dominates the GitHub Actions bill — to the point that the org's spending limit has been hit and blocked merges on multiple repos this month. The cost lands on humans too: even non-agent PRs eat duplicate `push:main` builds after merge.

## What Changes

Apply a coordinated budget posture across the gitguardex repo's own workflows AND seed a `templates/github/workflows/` directory that bootstraps the same defaults into every project that uses gitguardex.

Live workflows in this repo:

- `ci.yml` — drop `push: main` trigger (PR-time runs cover correctness under branch protection); drop the Node 18/22 matrix from PR-time (moved to a weekly `ci-full.yml`); add `paths-ignore` for docs/openspec/changeset paths; add `concurrency: cancel-in-progress`; gate the `test` job on `pull_request.draft == false`; add `ready_for_review` to the trigger list.
- `ci-full.yml` *(new)* — weekly schedule + `workflow_dispatch` runs the full Node 18 / 22 matrix that no longer runs per-PR.
- `codeql.yml` — drop `push:main` and `pull_request` triggers; keep weekly schedule + `branch_protection_rule` + `workflow_dispatch`; add concurrency.
- `cr.yml` — add concurrency; add `ready_for_review` trigger; skip on draft PRs and on `agent/*` head branches (the largest single CR-bill cut for agent-heavy repos).
- `scorecard.yml` — drop `push:main`; keep weekly schedule + `branch_protection_rule` + `workflow_dispatch`.

Templates seeded for downstream projects (`templates/github/workflows/`):

- `ci.yml` — same posture as the live `ci.yml` with placeholder steps.
- `ci-full.yml` — same posture as the live `ci-full.yml` with placeholder steps.
- `cr.yml` — mirrors the live `cr.yml` (including the `agent/*` skip pattern).
- `README.md` — documents the four trims, when to keep them, and when to relax.

## Impact

- **Repo CI bill drops materially.** Per-PR runs are now: one CI job on a single Node version, AI review only on human PRs, no CodeQL/Scorecard per PR. Cross-version compat coverage moves to a weekly schedule.
- **Per-PR feedback loop changes**: agents iterating in draft mode get no CI feedback until they promote to ready-for-review. Trade-off accepted: agents already run `pnpm test`/`pnpm typecheck`/`pnpm lint` in their worktrees before opening PRs; the CI gate is a final check, not the inner loop.
- **No AI code review on agent PRs.** Documented as a maintainer opt-in via a `needs-review` label or by stripping the `agent/*` guard from `cr.yml`.
- **Templates make this the default for every gitguardex-managed project**, so future repos don't have to discover the same posture independently.
- **No code changes outside `.github/workflows/` and `templates/github/`.** No runtime behavior change, no test changes, no scripts touched.
