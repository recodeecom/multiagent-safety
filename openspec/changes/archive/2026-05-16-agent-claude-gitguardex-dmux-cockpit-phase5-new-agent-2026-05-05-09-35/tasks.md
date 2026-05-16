# Tasks

## 1. Spec
- [x] 1.1 Capture proposal in `proposal.md`
- [x] 1.2 Capture spec delta in `specs/cockpit-new-agent/spec.md`

## 2. Tests
- [x] 2.1 Add `test/cockpit-new-agent.test.js` covering printable
       char append, backspace trim, Enter emits `agent:start` with
       `task`, Esc cancels, and the rendered prompt panel.

## 3. Implementation
- [x] 3.1 Add `path` import to `src/cockpit/control.js`.
- [x] 3.2 Extend `buildIntent('agent:start')` to include `task` from
       `state.newAgentInput`.
- [x] 3.3 Update Enter handler in `new-agent` mode to clear
       `newAgentInput` and emit the enriched intent.
- [x] 3.4 Add new-agent input handler ABOVE the global
       `n`/`t`/`l`/`s`/`?` shortcuts so typing letters lands in the
       buffer instead of re-routing.
- [x] 3.5 Replace placeholder `renderNewAgentPanel` with a dmux-style
       modal (heading, project row, agent/base, input box with
       cursor, footer hints).

## 4. Cleanup
- [x] 4.1 Commit changes on the agent branch.
- [x] 4.2 Push branch and open a PR.
- [x] 4.3 Run `gx branch finish ... --via-pr --wait-for-merge --cleanup`.
- [x] 4.4 Record PR URL and `MERGED` evidence.
