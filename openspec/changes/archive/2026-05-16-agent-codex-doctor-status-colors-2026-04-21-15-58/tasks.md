## 1. Specification

- [x] 1.1 Define the doctor status-color requirement for human-readable output.

## 2. Implementation

- [x] 2.1 Color doctor success/failure/pending lines with semantic ANSI colors when color output is enabled.
- [x] 2.2 Add a regression that forces ANSI output and checks both red failure lines and green success lines.

## 3. Verification

- [x] 3.1 Run `node --check bin/multiagent-safety.js`.
- [x] 3.2 Run `node --test --test-name-pattern "doctor" test/install.test.js`.
- [x] 3.3 Run `openspec validate agent-codex-doctor-status-colors-2026-04-21-15-58 --type change --strict`.
- [x] 3.4 Run `openspec validate --specs`.

Verification note: `node --check bin/multiagent-safety.js` passed. `node --test --test-name-pattern "doctor" test/install.test.js` passed with 18 doctor-focused tests, including the new forced-color regression. `openspec validate agent-codex-doctor-status-colors-2026-04-21-15-58 --type change --strict` passed, and `openspec validate --specs` returned `No items found to validate.`

## 4. Completion

- [x] 4.1 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [x] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
