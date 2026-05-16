## ADDED Requirements

### Requirement: README follows the 9-section design handoff structure

The repo-root `README.md` SHALL follow a numbered, install-first narrative so new readers on GitHub and npmjs.com hit the value pitch within the first screen.

#### Scenario: section ordering

- **GIVEN** a reader lands on `README.md` via GitHub or npmjs
- **WHEN** they scroll from top to bottom
- **THEN** the sections SHALL appear in this exact order, each prefixed with a numbered `0X` chip:
  1. hero (logo + tagline + sub) and badge + nav rows
  2. `01` Install in one line
  3. `02` The problem
  4. `03` What it does
  5. `04` Daily workflow
  6. `05` What `gx` shows first
  7. `06` How `AGENTS.md` is handled
  8. `07` Commands
  9. `08` v6 → v7 migration
  10. `09` Known rough edges

### Requirement: Install section fits in one screen

The `01 Install in one line` section SHALL be ≤ 15 rendered lines in the default GitHub viewport (including the code block and admonitions) so install instructions stay above the fold on 1280×720 desktops.

#### Scenario: compact install block

- **GIVEN** the `01` section
- **WHEN** rendered on github.com or npmjs.com
- **THEN** the section SHALL contain:
  - a single 3-line fenced `bash` code block: `npm i -g @imdeadpool/guardex`, `cd /path/to/your-repo`, `gx setup` (with a trailing comment)
  - a centered "THE PROMISE" tagline quoting `guard many agent. keep one repo clean.`
  - exactly two admonitions: `> [!WARNING]` (not-affiliated disclaimer) and `> [!IMPORTANT]` (in-progress caveat).

### Requirement: README preserves existing shields.io badge URLs

The hero badge row SHALL reuse the shields.io URLs from the prior release (`npm version`, `npm downloads/month`, `CI`, `OpenSSF Scorecard`, `stars`, `last commit`, `license`) so the live badges keep rendering without 404s on npm / GitHub mirrors.

#### Scenario: migrating from the long README

- **GIVEN** the README is rewritten to the new 9-section structure
- **WHEN** the diff is reviewed
- **THEN** every `img.shields.io/...` URL present in the prior README SHALL still be present in the new README (possibly reordered)
- **AND** no new third-party badge provider SHALL be added without an explicit spec update.

### Requirement: Workflow + Commands sections use GFM tables, not deep sub-sections

The `04 Daily workflow` and `07 Commands` sections SHALL render their structured content as GFM tables + fenced code blocks. Deep `###` nesting beyond one level SHALL NOT be used for these two sections.

#### Scenario: Commands section depth

- **GIVEN** the `07 Commands` section
- **WHEN** rendered
- **THEN** the section SHALL contain at most three `###` subsections (Core / Lifecycle / Protected branches) and SHALL NOT contain `####` or deeper headings
- **AND** Core and Lifecycle SHALL each be a two-column GFM table (`command` · `does`).

### Requirement: AGENTS.md handling section uses an admonition + decision table

The `06 How AGENTS.md is handled` section SHALL lead with a `> [!IMPORTANT]` admonition stating the non-destructive contract, followed by a 4-row GFM decision table keyed on "Your repo has…" → "`gx setup` / `gx doctor` does…".

#### Scenario: AGENTS.md handling rows

- **GIVEN** the `06` section
- **THEN** the decision table SHALL contain exactly these four rows, in order:
  1. `AGENTS.md` **with** markers → refresh only the managed block
  2. `AGENTS.md` **without** markers → append the managed block to the end
  3. No `AGENTS.md` → create it with the managed block
  4. A root `CLAUDE.md` → leave it alone.
