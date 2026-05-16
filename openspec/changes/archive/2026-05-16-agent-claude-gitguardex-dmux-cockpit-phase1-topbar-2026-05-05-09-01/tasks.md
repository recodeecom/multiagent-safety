# Tasks

## 1. Spec
- [x] 1.1 Capture proposal in `proposal.md`
- [x] 1.2 Capture spec delta in `specs/cockpit-control/spec.md`

## 2. Tests
- [x] 2.1 Update `test/cockpit-sidebar.test.js` snapshot to include the
       new `[l]ogs [p]rojects` row.
- [x] 2.2 Add control test asserting `l` opens `logs` mode and
       returns to `main` on Esc.
- [x] 2.3 Add control test asserting `p` opens `projects` mode only
       when no lane is selected, and the existing pane-menu PR action
       still fires when a lane is selected.
- [x] 2.4 Add render-frame test asserting the dmux-style `[l]ogs` /
       `[p]rojects` row appears in `renderControlFrame` output.

## 3. Implementation
- [x] 3.1 Add `logs` and `projects` to `MODES` and
       `EMPTY_ACTION_ROWS` in `src/cockpit/control.js`.
- [x] 3.2 Add `logs` / `projects` cases to `openActionRow`.
- [x] 3.3 In `applyKey`, route `l` to `openActionRow(..., 'logs')`
       and route `p` to `openActionRow(..., 'projects')` only when
       `current.selectedScope === 'action'`.
- [x] 3.4 Add `renderLogsPanel` and `renderProjectsPanel` placeholder
       renderers and dispatch them from `renderPanel`.
- [x] 3.5 Extend the sidebar shortcut block in
       `src/cockpit/sidebar.js` to a 3-row layout.
- [x] 3.6 Update the in-app shortcuts help text with `l` and `p`.

## 4. Cleanup
- [x] 4.1 Commit changes on the agent branch.
- [x] 4.2 Push branch and open a PR.
- [x] 4.3 Run `gx branch finish ... --via-pr --wait-for-merge --cleanup`.
- [x] 4.4 Record PR URL and `MERGED` evidence.
