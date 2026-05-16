## Why

- GitGuardex already ships several Scorecard-friendly guardrails, but key supply-chain signals still lag behind the repository's actual intent.
- The release workflow publishes to npm with provenance but leaves GitHub releases without signed assets, so Scorecard cannot award signed-release credit.
- CI and CodeQL do not run on pull requests to `main`, which weakens branch-protection hardening because there are no stable pre-merge checks to require.
- Package metadata and security/reporting metadata still contain avoidable drift such as range-based dependency specifiers and a repo link that points elsewhere.

## What Changes

- Run CI and CodeQL for pull requests targeting `main` so required status checks have real pre-merge coverage.
- Extend the release workflow to build the npm tarball, checksum it, sign it with a Sigstore bundle, and upload those artifacts to the matching GitHub release.
- Expand Dependabot to cover npm packages and pin package dependency specifiers exactly in both `package.json` and `package-lock.json`.
- Correct security-reporting and code-owner metadata needed for stricter GitHub review settings.

## Impact

- Affects GitHub Actions workflows, dependency metadata, and security/review docs only; runtime CLI behavior stays unchanged.
- Signed-release score gains apply to future or re-run releases; historical releases without assets remain unchanged until republished or manually backfilled.
- Branch-protection, maintained, contributors, and code-review scores still depend partly on live GitHub settings, repo age, and human review history outside this diff.
