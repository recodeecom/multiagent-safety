# Proposal: tighten Guardex token-fragmentation prompts

Guardex already prefers phase-based execution, but the copied `gx prompt` task loop still underspecifies the anti-fragmentation pattern. This change makes the repo contract and prompt output teach the stronger classifier: low output alone is fine when the run is bounded, while long low-output sessions with repeated peeks or `write_stdin` loops are fragmentation.

- add the bounded-vs-fragmented classifier to `AGENTS.md`
- teach `gx prompt` to say inspect once, patch once, verify once, then finish
- lock the prompt wording with focused tests
