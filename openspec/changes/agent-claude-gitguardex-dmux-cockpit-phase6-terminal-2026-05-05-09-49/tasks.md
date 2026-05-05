# Tasks

## 1. Spec
- [x] 1.1 Capture proposal in `proposal.md`
- [x] 1.2 Capture spec delta in `specs/cockpit-terminal-action/spec.md`

## 2. Tests
- [x] 2.1 Add `test/cockpit-terminal-action.test.js` covering the
       alias routing for `terminal:open`/`agent:start`, the
       `dispatchCockpitIntent` helper, the missing-session
       fall-back, and the empty-intent failure path.

## 3. Implementation
- [x] 3.1 Add `'terminal:open'` and `'agent:start'` aliases to
       `PANE_ACTION_HANDLERS` in `src/cockpit/pane-actions.js`.
- [x] 3.2 Add `COCKPIT_INTENT_ALIASES` mapping intent types to action
       IDs.
- [x] 3.3 Add `dispatchCockpitIntent(intent, context)` helper that
       merges intent fields into the dispatch context and routes
       through `dispatchPaneAction`.
- [x] 3.4 Export `COCKPIT_INTENT_ALIASES` and `dispatchCockpitIntent`
       from the module so external callers can use them.

## 4. Cleanup
- [ ] 4.1 Commit changes on the agent branch.
- [ ] 4.2 Push branch and open a PR.
- [ ] 4.3 Run `gx branch finish ... --via-pr --wait-for-merge --cleanup`.
- [ ] 4.4 Record PR URL and `MERGED` evidence.
