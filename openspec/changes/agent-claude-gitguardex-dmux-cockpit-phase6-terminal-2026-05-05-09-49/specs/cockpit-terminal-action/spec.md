## ADDED Requirements

### Requirement: Cockpit pane action dispatcher accepts intent aliases
The cockpit pane action dispatcher SHALL recognize the cockpit intent
types `terminal:open` and `agent:start` as direct action IDs that
route to `runAddTerminal` and `runAddAgent` respectively, in addition
to the existing `add-terminal` and `add-agent` action IDs.

#### Scenario: terminal:open routes to launchTerminalPane
- **WHEN** `dispatchPaneAction('terminal:open', { runtime: { terminalBackend } })`
  is called against a backend that exposes `launchTerminalPane`
- **THEN** `launchTerminalPane` is invoked exactly once
- **AND** the returned result has `ok === true`.

#### Scenario: agent:start routes to runAddAgent
- **WHEN** `dispatchPaneAction('agent:start', { startAgentLane, runtime, ... })`
  is called with a `worktreePath` in the context
- **THEN** the provided `startAgentLane` hook is invoked once with the
  forwarded `task`, `agent`, `base`, and `worktreePath` fields.

### Requirement: Cockpit ships a dispatchCockpitIntent helper
The cockpit module SHALL export a `dispatchCockpitIntent(intent,
context)` helper that takes a structured cockpit intent (the
`lastIntent` produced by control state transitions) and routes it
through `dispatchPaneAction`, merging the intent fields into the
dispatch context.

#### Scenario: dispatchCockpitIntent merges intent into context
- **WHEN** `dispatchCockpitIntent({ type: 'terminal:open', sessionId,
  branch, worktreePath }, { runtime: { terminalBackend } })` is called
- **THEN** the dispatched action context contains the intent's
  `sessionId`, `branch`, and `worktreePath`
- **AND** `launchTerminalPane` is invoked with `actionId === 'add-terminal'`
  and the merged worktree path.

#### Scenario: dispatchCockpitIntent rejects empty intents
- **WHEN** `dispatchCockpitIntent(null, ...)` or
  `dispatchCockpitIntent({}, ...)` is called
- **THEN** the result has `ok === false` and the message contains
  `No cockpit intent`.

### Requirement: Cockpit exposes COCKPIT_INTENT_ALIASES for external dispatchers
The cockpit module SHALL export a frozen `COCKPIT_INTENT_ALIASES` map
from intent types (`terminal:open`, `agent:start`) to action IDs
(`add-terminal`, `add-agent`) so external dispatchers can normalize
intent types if they prefer the action-ID surface.

#### Scenario: Aliases map intent types to action IDs
- **WHEN** the cockpit module is required
- **THEN** `COCKPIT_INTENT_ALIASES['terminal:open']` equals
  `'add-terminal'` and `COCKPIT_INTENT_ALIASES['agent:start']` equals
  `'add-agent'`.
