# agent-codex-add-session-severity-scoring-command-2026-04-22-23-28 (minimal / T1)

- Add `gx report session-severity` as a native GitGuardex report subcommand with the fixed weighted rubric for healthy / mildly fragmented / inefficient / runaway / catastrophic sessions.
- Keep the scoring logic in a small report module and thread it through the existing `gx report` help, parsing, and output surface instead of shipping a repo-local side script.
- Lock the new report surface with focused CLI arg parsing and report integration tests.
- Verification:
  - `node --test test/cli-args-dispatch.test.js test/report.test.js`
  - `node bin/multiagent-safety.js report help`
  - `node bin/multiagent-safety.js report session-severity --task-size narrow-patch --tokens 3850000 --exec-count 18 --write-stdin-count 6 --completion-before-tail yes --fragmentation 14 --finish-path 6 --post-proof 4`
  - `git diff --check`
