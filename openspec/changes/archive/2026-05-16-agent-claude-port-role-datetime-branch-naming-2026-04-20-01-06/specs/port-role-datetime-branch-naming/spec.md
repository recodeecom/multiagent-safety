## ADDED Requirements

### Requirement: agent-branch-start emits `agent/<role>/<task>-<YYYY-MM-DD>-<HH-MM>` branch names
`templates/scripts/agent-branch-start.sh` SHALL construct branch names as `agent/<role>/<task-slug>-<YYYY-MM-DD>-<HH-MM>`, with NO Codex snapshot slug and NO cksum-derived 6-hex suffix embedded in the leaf.

#### Scenario: Claude-role agent name
- **WHEN** `agent-branch-start.sh` runs with `AGENT_NAME` containing the substring `claude` (e.g. `claude-demo`, `claude-admin`)
- **THEN** the branch name begins with `agent/claude/<task-slug>-` followed by a UTC-local timestamp in `YYYY-MM-DD-HH-MM` form.

#### Scenario: Codex-role agent name with account email fragments
- **WHEN** `agent-branch-start.sh` runs with `AGENT_NAME=codex-admin-recodee-com` and `GUARDEX_CODEX_AUTH_SNAPSHOT=Zeus Portasmosonmagyarovar Hu Snapshot`
- **THEN** the branch name is `agent/codex/<task-slug>-<YYYY-MM-DD>-<HH-MM>`
- **AND** the leaf does NOT contain `zeus`, `portasmosonma`, `admin-recodee`, or any 6-hex checksum fragment.

#### Scenario: Explicit role override via GUARDEX_AGENT_TYPE
- **WHEN** `GUARDEX_AGENT_TYPE=integrator` is set
- **THEN** the branch is created as `agent/integrator/<task-slug>-<YYYY-MM-DD>-<HH-MM>`
- **AND** the override wins over claude/codex substring matching and the `CLAUDECODE` sentinel.

### Requirement: `normalize_role()` role resolution order
`templates/scripts/agent-branch-start.sh` SHALL resolve the role token using, in priority order: (1) `GUARDEX_AGENT_TYPE` env var, (2) substring match against `AGENT_NAME` for `claude` then `codex`, (3) `CLAUDECODE=1` sentinel → `claude`, (4) fallback `codex`.

#### Scenario: CLAUDECODE sentinel promotes unknown roles to claude
- **WHEN** `AGENT_NAME=bot` (no substring match) and `CLAUDECODE=1` is set
- **THEN** the branch uses role `claude`.

#### Scenario: Fallback to codex when nothing matches
- **WHEN** `AGENT_NAME=bot` with `CLAUDECODE=0` (sentinel disabled) and no `GUARDEX_AGENT_TYPE` override
- **THEN** the branch uses role `codex`.

### Requirement: `--print-name-only` is side-effect-free
`templates/scripts/agent-branch-start.sh` SHALL accept `--print-name-only` to print the computed branch name on stdout and exit without creating a branch, worktree, or OpenSpec scaffold.

#### Scenario: Deterministic output with fixed timestamp
- **WHEN** `GUARDEX_BRANCH_TIMESTAMP=2026-04-20-01-08 scripts/agent-branch-start.sh --print-name-only "fix-login-bug" "claude-demo"` is invoked
- **THEN** stdout is `agent/claude/fix-login-bug-2026-04-20-01-08`
- **AND** no Git refs, worktrees, or OpenSpec directories are created.

### Requirement: `--tier` flag is accepted silently
`templates/scripts/agent-branch-start.sh` SHALL accept a `--tier <T0|T1|T2|T3>` flag and consume its value without failing, even though scaffold sizing by tier is not yet wired through this script.

#### Scenario: Tier flag is forwarded through without error
- **WHEN** `scripts/agent-branch-start.sh --tier T1 "task" "claude-x"` is invoked
- **THEN** the script exits 0 and proceeds as if no tier were specified.
