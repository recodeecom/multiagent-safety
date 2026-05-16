## ADDED Requirements

### Requirement: GuardeX brand block in the top bar
The How-It-Works page SHALL render a GuardeX brand block in the top bar to the right of the existing "How it works" block.

#### Scenario: Layout
- **WHEN** the page mounts
- **THEN** the top bar's left region SHALL contain two `.brand-block` elements separated by a vertical `.brand-divider`
- **AND** the first brand block SHALL continue to show the `R` mark, the title "How it works", and the subtitle "Watch an agent run — from prompt to merged PR"
- **AND** the second brand block SHALL show an inline T-Rex SVG mark, the title "GuardeX", and the tagline "the Guardian T-Rex for your repo"
- **AND** the GuardeX tagline SHALL render in accent-green italic so it reads as the product tagline, not a generic subtitle.

### Requirement: Copy affordance on shell tool-call rows
Every tool-call row with `kind === 'shell'` SHALL expose a copy button that writes the row's `value` string to the clipboard.

#### Scenario: Button renders for shell rows only
- **WHEN** a step contains a `tool` message with rows of mixed kinds
- **THEN** each `shell` row SHALL render a trailing `.t-copy` button
- **AND** `read`, `write`, `tool` rows SHALL NOT render that button.

#### Scenario: Copy action
- **WHEN** the user clicks the `.t-copy` button on a shell row
- **THEN** the row's `value` SHALL be copied via `navigator.clipboard.writeText`, falling back to a `document.execCommand('copy')` shim if `navigator.clipboard` is unavailable
- **AND** the button icon SHALL swap from `copy` to `check` for ~1400 ms before reverting
- **AND** the button SHALL apply a `copied` class during that window so the icon colour and background shift to the accent-green palette.

#### Scenario: Keyboard + accessibility
- **WHEN** the `.t-copy` button has keyboard focus
- **THEN** a 2px accent-green outline SHALL render around it
- **AND** the button SHALL set `aria-label="Copy command"` (or `"Copied"` while the confirmation is visible).

### Requirement: Realistic gx doctor transcript in Installation Step 02
Installation mode Step 02 SHALL render code-panel output that mirrors the real `gx doctor` command output users see on their own machine.

#### Scenario: Transcript contents
- **WHEN** the user reaches Installation mode Step 02
- **THEN** the code panel SHALL render, in order:
  1. A `$ gx doctor` command line.
  2. A `[guardex] Doctor/fix: <repo-path>` header.
  3. A list of at least 10 `- unchanged` or `- skipped-conflict` rows (mixing `.omx/*`, `scripts/*`, and `.githooks/*` paths).
  4. A `- hooksPath    set core.hooksPath=.githooks` row.
  5. A `[guardex] Scan target:` line and `[guardex] Branch: dev` line.
  6. A `[guardex] ✅ No safety issues detected.` line (rendered in accent green).
  7. A `[guardex] Auto-finish sweep (base=dev): attempted=…, completed=…, skipped=…, failed=…` summary.
  8. At least one `[skip] …already merged into dev.` row and at least one `[fail] …resolve conflicts.` row.
  9. A final `[guardex] ✅ Repo is fully safe.` line in accent green.
