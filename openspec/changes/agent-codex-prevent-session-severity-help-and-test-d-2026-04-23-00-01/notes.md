# agent-codex-prevent-session-severity-help-and-test-d-2026-04-23-00-01 (minimal / T1)

- Move the `report session-severity` help contract into the report module so usage text, example args, and rubric summary come from the same source as the scorer.
- Keep the scored-output assertions hard-coded in tests while reusing the shared example args, so score changes still break tests instead of silently updating expectations.
- Add focused help coverage that proves the CLI help prints the shared session-severity contract text.
- Verification:
  - `node --test test/report.test.js test/cli-args-dispatch.test.js`
  - `node bin/multiagent-safety.js report help`
  - `node bin/multiagent-safety.js report session-severity --task-size narrow-patch --tokens 3850000 --exec-count 18 --write-stdin-count 6 --completion-before-tail yes --fragmentation 14 --finish-path 6 --post-proof 4`
  - `git diff --check`
