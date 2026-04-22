## ADDED Requirements

### Requirement: Active session records expose live heartbeat freshness
Guardex SHALL write active-session records with a heartbeat timestamp that the extension can use to distinguish live sessions from crashed or abandoned launcher records.

#### Scenario: Session start creates heartbeat fields
- **WHEN** the active-session helper starts a session record
- **THEN** the JSON record includes `startedAt`
- **AND** the JSON record includes `lastHeartbeatAt`
- **AND** the JSON record includes an advisory `state` value.

#### Scenario: Heartbeat refreshes an existing record
- **WHEN** `gx internal heartbeat --branch <branch>` is run in a Guardex repo with an active-session record for that branch
- **THEN** the matching record's `lastHeartbeatAt` advances
- **AND** existing task, branch, pid, and worktree metadata are preserved.

### Requirement: Active Agents keeps repo-root changes separate from sandbox changes
The extension SHALL show repo-root `CHANGES` only for dirty files that belong to the guarded repo root, not files under managed agent worktrees or session-state internals.

#### Scenario: Managed worktree files are dirty under the repo root
- **WHEN** `git status --porcelain` reports changes under `.omx/agent-worktrees/` or `.omc/agent-worktrees/`
- **THEN** those paths are omitted from the repo-root `CHANGES` section.

#### Scenario: Session state files are dirty
- **WHEN** `.omx/state/active-sessions/*.json` or `.omx/state/agent-file-locks.json` is dirty
- **THEN** those state files are omitted from repo-root `CHANGES`.

### Requirement: Active Agents shows touched files under each live session
The extension SHALL render changed-file rows beneath each session row when a sandbox worktree has touched files.

#### Scenario: Session worktree has dirty files
- **WHEN** a session derives `working` state from dirty worktree paths
- **THEN** the session row is expandable
- **AND** its children list the touched worktree-relative files.

#### Scenario: Touched file is locked by another branch
- **WHEN** a session touched file intersects `.omx/state/agent-file-locks.json` with an owner branch different from the session branch
- **THEN** that file row uses a warning icon
- **AND** its tooltip names the lock owner.

### Requirement: Active Agents publishes context keys for surrounding UI
The extension SHALL publish context keys that describe whether agents and lock conflicts are currently visible.

#### Scenario: Provider refresh observes sessions and conflicts
- **WHEN** the Active Agents provider refreshes
- **THEN** it sets `guardex.hasAgents` to true if at least one session is present
- **AND** it sets `guardex.hasConflicts` to true if any visible touched file or repo-root change is locked by another branch.
