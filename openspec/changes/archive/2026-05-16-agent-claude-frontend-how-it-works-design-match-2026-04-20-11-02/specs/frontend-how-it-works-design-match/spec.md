## ADDED Requirements

### Requirement: How-It-Works tutorial chrome matches the Claude Design handoff
The tutorial page at `frontend/app/page.tsx` SHALL render a two-pane layout that visually matches the canonical design file (`recodeeplan/project/How It Works Tutorial.html` in the Claude Design export), including the VS Code titlebar, activity bar, source-control tree, editor tabs, diff gutter, and status bar.

#### Scenario: Baseline rendering
- **WHEN** the How-It-Works page mounts on `Execute mode · Step 01`
- **THEN** the top bar renders `How it works` / `Watch an agent run — from prompt to merged PR`
- **AND** both panes show the floating `chat · recodee` and `vs code · live` labels
- **AND** the VS Code pane renders a titlebar (`● ● ●  recodee — VS Code`), activity bar, Source Control header, the `dev` baseline worktree card, an empty editor tab row, and the blue status bar
- **AND** the page fills 100vh without outer padding (flush-edge).

#### Scenario: Chat bubble labels
- **WHEN** a step surfaces a `thinking` message
- **THEN** the bubble SHALL show the `✦ thinking` overline in purple monospace, use a dashed border, and render inside the assistant column.
- **WHEN** a step surfaces a `plan-list` message
- **THEN** the bubble SHALL show the `□ proposed phases` overline, a 3px purple left border, and an ordered list of phases with a muted meta span.
- **WHEN** a step surfaces a `hint` message
- **THEN** the bubble SHALL use a purple-tinted background and a monospace font family.

#### Scenario: Source-control worktree behavior
- **WHEN** a step defines one or more worktree rows
- **THEN** each card SHALL render with a branch icon colored by kind (base=grey, active=purple, readonly=purple background, merge=amber), the changes count badge, an optional commit CTA, and a file tree whose rows use extension-colored badges (RS, TS, TSX, MD, etc.)
- **AND** conflict-marked files SHALL render with a red background and a `!` status.

#### Scenario: Diff gutter and typing caret
- **WHEN** a code line has `kind: "added"`
- **THEN** the gutter cell SHALL display a green `+`.
- **WHEN** a code line has `kind: "removed"`
- **THEN** the gutter cell SHALL display a red `−` and the content SHALL render dimmed.
- **WHEN** a code line is marked `typing`
- **THEN** a 2px-wide blue caret SHALL blink at the end of the line.

#### Scenario: Dev pull animation on completion
- **WHEN** a step sets `showPullAnimation: true`
- **THEN** the baseline `dev` worktree card SHALL apply the `dev-pulling` class, render a `pull-bar` with the `pullSlide` sweep animation, display a `↓ pull · +1 commit` chip in the card head, and replace the baseline message with an info-toned "Pulling merged commit from origin/dev…" string
- **AND** the status bar sync indicator SHALL reflect the step's `statusSync` value (for example `↓ 1 ↑ 0`).

#### Scenario: Keyboard navigation
- **WHEN** the user presses `ArrowRight`
- **THEN** the page advances to the next step, looping back to step 01 after the final step.
- **WHEN** the user presses `ArrowLeft`
- **THEN** the page goes back one step (disabled at step 01).
- **WHEN** the user presses `Escape`
- **THEN** the page resets to `Execute mode · Step 01`.

#### Scenario: Mode switch resets the walkthrough
- **WHEN** the user clicks a different mode in the top segmented control (`Execute`, `Plan`, `Merge`)
- **THEN** the active mode SHALL swap to that mode's step array, reset the step index to 0, and re-trigger the chat/source-control/editor animations.
