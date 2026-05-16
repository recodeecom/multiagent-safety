## ADDED Requirements

### Requirement: New-agent mode captures a prompt buffer
The cockpit `new-agent` mode SHALL maintain `state.newAgentInput` as
a string buffer that grows when the user types printable ASCII
characters and shrinks by one character on backspace.

#### Scenario: Printable characters append to the buffer
- **WHEN** the cockpit is in `new-agent` mode and the user types
  `h`, `i`, ` `, `!`
- **THEN** `state.newAgentInput` is `'hi !'`
- **AND** the cockpit remains in `new-agent` mode (no global shortcut
  hijacks the keystroke).

#### Scenario: Backspace trims the last character
- **WHEN** the cockpit is in `new-agent` mode with
  `newAgentInput === 'abc'` and the user presses backspace
- **THEN** `state.newAgentInput` becomes `'ab'`.

### Requirement: Enter on new-agent emits an enriched agent:start intent
The cockpit key handler SHALL respond to `Enter` in `new-agent` mode
by emitting `lastIntent = { type: 'agent:start', agent, base, task }`
where `task` is the trimmed `newAgentInput`, then clearing the buffer
and returning to `main` mode.

#### Scenario: Enter submits the typed task
- **WHEN** the cockpit is in `new-agent` mode with
  `newAgentInput === 'fix auth'` and the user presses `Enter`
- **THEN** the resulting state has `mode === 'main'`,
  `newAgentInput === ''`, and `lastIntent` equals
  `{ type: 'agent:start', agent: <default>, base: <default>, task:
  'fix auth' }`.

#### Scenario: Esc cancels without emitting an intent
- **WHEN** the cockpit is in `new-agent` mode and the user presses
  `Esc`
- **THEN** the resulting state has `mode === 'main'` and
  `lastIntent === null`.

### Requirement: New-agent panel renders the dmux-style prompt modal
The cockpit `new-agent` mode panel SHALL render a heading containing
`+ New Pane -` followed by the project name, project / agent / base
rows, a bordered input box containing `> <buffer>_`, and a footer
listing `Enter to submit`, `Backspace to edit`, and `Esc to cancel`.

#### Scenario: Panel shows heading, input box, and footer
- **WHEN** the cockpit is in `new-agent` mode with `repoPath ===
  '/repo/gitguardex'` and `newAgentInput === 'refresh status'`
- **THEN** the rendered panel contains `+ New Pane - gitguardex`
- **AND** contains `| > refresh status_`
- **AND** the footer contains `Enter to submit` and `Esc to cancel`.
