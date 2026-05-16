## ADDED Requirements

### Requirement: Copyable install command pill in the top bar
The tutorial page SHALL render a prominent, copy-to-clipboard control showing the exact install command.

#### Scenario: Pill renders
- **WHEN** the page mounts
- **THEN** the top bar SHALL include a button labelled `$ npm i -g @imdeadpool/guardex` with a copy icon.

#### Scenario: Copy action
- **WHEN** the user clicks the install pill
- **THEN** the string `npm i -g @imdeadpool/guardex` SHALL be written to the clipboard via `navigator.clipboard.writeText`, falling back to a `document.execCommand('copy')` shim if `navigator.clipboard` is unavailable
- **AND** the copy icon SHALL swap to a green check
- **AND** a "copied" toast SHALL render below the pill for ~1600ms before reverting.

### Requirement: Installation mode walkthrough
The tutorial SHALL expose a fourth mode named `Installation` that demos the full install-to-first-PR flow.

#### Scenario: Mode appears in the segmented control
- **WHEN** the page mounts
- **THEN** the mode segmented control SHALL render four buttons in order: `Execute mode`, `Plan mode`, `Merge mode`, `Installation`
- **AND** the `Installation` button SHALL carry the blue `dotc.i` accent (distinct from the green `a`, purple `p`, amber `m` dots).

#### Scenario: Installation steps
- **WHEN** the user activates `Installation`
- **THEN** the walkthrough SHALL contain exactly five steps in this order:
  1. Install the CLI globally (`npm i -g @imdeadpool/guardex`)
  2. Audit the repo with `gx doctor`
  3. Wire the repo with `gx setup`
  4. Start an agent worktree with `gx start "<task>" "<agent-name>"`
  5. Finish with `gx finish --via-pr --wait-for-merge --cleanup` (ending on a clean `dev` baseline with the dev-pull animation active).

### Requirement: Parallel lane showcases Claude + Codex coexistence
Execute mode Step 06 and Step 07 SHALL show a Claude worktree running alongside the Codex Rust-port worktree.

#### Scenario: Second worktree is a Claude sandbox
- **WHEN** the user reaches Execute mode Step 06 or Step 07
- **THEN** the Source Control panel SHALL show two active worktrees: one `agent_codex__dashboard-rust-port-421` on branch `agent/codex/dashboard-rust-port-421`, and one `agent_claude__projects-hydration-mismatch-sidebar` on branch `agent/claude/projects-hydration-mismatch-sidebar`
- **AND** the Claude worktree SHALL carry the tag `claude · parallel`
- **AND** the step description SHALL explicitly reference Claude running alongside Codex.

#### Scenario: Status bar reflects active lane
- **WHEN** the user is on Execute Step 06 or Step 07
- **THEN** the VS Code status bar branch indicator SHALL read `agent/claude/projects-hydration-mismatch-sidebar`.
