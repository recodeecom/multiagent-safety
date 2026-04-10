# OpenSSF Scorecard Remediation Plan

Based on baseline report: `docs/reports/openssf-scorecard-baseline-2026-04-10.md`.

## Priority 0 (repository settings)

These typically give the largest score gain fastest:

1. **Code-Review (0 → target 10)**
   - Enforce pull-request reviews on `main`.
   - Require at least 1 approver (2 recommended for critical changes).
   - Include administrators in enforcement.

2. **Branch-Protection (3 → target 10)**
   - Require status checks before merge.
   - Disallow force pushes and branch deletion on protected branches.
   - Require up-to-date branches before merge.

3. **Maintained (0 → target 10)**
   - Keep recent issue/PR activity and closure cadence visible.
   - Maintain release cadence and changelog updates.

## Priority 1 (automation & workflows)

1. **SAST (0 → target 10)**
   - Add and keep a CodeQL workflow enabled for JavaScript/TypeScript.

2. **Pinned-Dependencies (0 → target 10)**
   - Pin GitHub Action versions to immutable commit SHAs.

3. **Fuzzing (0 → target 10)**
   - Add automated fuzz/property testing in CI for CLI parsing and critical flows.

## Priority 2 (ecosystem/process)

1. **CII-Best-Practices (0 → target 10)**
   - Enroll project in OpenSSF Best Practices badge program.

2. **Contributors (0 → target 10)**
   - Grow contributor diversity (multiple org/company affiliations where possible).

## Verification loop after changes

1. Re-run Scorecard report.
2. Update baseline report with new score + deltas.
3. Track changes in a short changelog section:
   - date
   - checks improved
   - score delta
