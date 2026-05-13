# `templates/github/workflows/` — budget-friendly CI defaults

Workflow files in this directory are copied into a gitguardex-managed
project's `.github/workflows/` directory when bootstrapping. They are
the **default** budget posture for projects that use `gx branch start`
to drive agent iterations.

Agent flows land a high volume of PRs per month. Without these trims,
every PR + every post-merge push fans out across CI, CodeQL, Scorecard,
and Code Review — which dominates the GitHub Actions bill for any
multi-agent repo. The trims below cut that cost without giving up
correctness coverage.

## What's trimmed and why

1. **`concurrency: cancel-in-progress: true`** scoped per workflow + ref
   so rapid pushes to the same agent branch cancel the prior run
   instead of letting both finish on Actions minutes.

2. **`if: github.event.pull_request.draft == false`** on every job that
   shouldn't run on a draft PR, paired with
   `pull_request.types: [..., ready_for_review]` in the trigger list so
   CI fires the moment the PR is promoted out of draft.

3. **`if: !startsWith(head.ref, 'agent/')`** on the Code Review job
   (`cr.yml`) — skip AI review on automated agent-lane PRs. AI review
   on hundreds of agent PRs per month burns both Actions minutes and
   OpenAI tokens without adding signal; human-authored PRs (any non-
   `agent/*` head branch) still get reviewed.

4. **No `push: main` trigger** in `ci.yml` — branch protection on
   `main` forces all changes through a PR, so PR-time CI is sufficient
   and post-merge CI on `main` was pure duplication. Use
   `workflow_dispatch` for ad-hoc full runs.

5. **`paths-ignore`** for docs / openspec / template-only changes — skip
   CI on changes that don't affect runtime behavior.

## Customizing

- Replace `placeholder` steps in `ci.yml` with your build/test/lint
  commands.
- Keep the `concurrency:`, `if:`, and `paths-ignore:` patterns. They
  are the load-bearing part of the budget posture; removing them undoes
  the win.

## When to skip the draft-skip pattern

If your CI is fast (≤ 2 min) and you want continuous validation as
agents iterate, drop the `if: pull_request.draft == false` job guard.
The concurrency cancel alone still prevents minute pile-up.

## When to re-enable AI code review on agent PRs

If your team relies on AI review as a true gating signal (not just
advisory), remove the `!startsWith(head.ref, 'agent/')` guard in
`cr.yml`. Expect the OpenAI bill to scale linearly with merge volume.

## What about CodeQL / Scorecard?

The gitguardex repo itself runs CodeQL and Scorecard on the **weekly
schedule + `workflow_dispatch`** only — not on per-PR / per-push
triggers. Those workflows are long-running (5–10 min for CodeQL) and
were the largest single line item on the monthly Actions bill before
this change. If your project needs per-PR CodeQL gating for compliance
reasons, re-add the `pull_request` trigger and accept the cost; for
most repos, weekly + on-demand is the right default.
