## ADDED Requirements

### Requirement: Session rows show lock ownership counts

The Active Agents tree MUST append `🔒 N` to each session row, where `N` is the number of lock-registry entries owned by that session's branch.

#### Scenario: session row includes branch lock count

- **WHEN** `.omx/state/agent-file-locks.json` contains entries owned by an active session branch
- **THEN** the rendered session row label includes `🔒 <count>`
- **AND** the session tooltip includes the same lock count

### Requirement: Repo-root changes warn on foreign locks

Repo-root `CHANGES` rows MUST warn when a changed file is claimed by a different branch than the repo worktree's current branch.

#### Scenario: repo-root change is locked by another branch

- **WHEN** a repo-root changed file appears in `.omx/state/agent-file-locks.json`
- **AND** the lock owner branch differs from the repo worktree's current branch
- **THEN** the corresponding `ChangeItem` uses a warning icon
- **AND** the tooltip names the lock owner branch

### Requirement: Lock registry reads are watcher-driven

The Active Agents provider MUST refresh cached lock state from lock-file watcher events and MUST NOT re-read the lock registry on every tree load.

#### Scenario: repeated tree loads do not re-read unchanged lock state

- **WHEN** the tree is loaded multiple times without a lock-file watcher event
- **THEN** the provider reuses cached lock state

#### Scenario: lock-file watcher refreshes cache

- **WHEN** `.omx/state/agent-file-locks.json` changes
- **THEN** the lock watcher refreshes the provider cache before the next tree render

### Requirement: Lock registry file is hidden from repo-root changes

The repo-root `CHANGES` section MUST ignore `.omx/state/agent-file-locks.json`.

#### Scenario: lock registry file is modified

- **WHEN** `.omx/state/agent-file-locks.json` is dirty in the repo root
- **THEN** it does not render as a `ChangeItem`
