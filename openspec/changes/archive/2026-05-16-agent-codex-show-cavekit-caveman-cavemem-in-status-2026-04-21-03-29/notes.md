# agent-codex-show-cavekit-caveman-cavemem-in-status-2026-04-21-03-29 (minimal / T1)

- Extend `gx status` so it reports `cavekit` and `caveman` alongside the existing companion tools using home-directory install footprints.
- Broaden `gx setup` companion install handling so missing npm companions and missing local `cavekit` / `caveman` installs are offered together behind the existing explicit approval flow.
- Move the README conflict diagram fully under `## The problem` and rewrite the labels to show agents overwriting and deleting each other's edits more explicitly.
- Verification:
  - `node --test test/install.test.js`
  - `git diff --check`
