## ADDED Requirements

### Requirement: Protected-branch write guard only targets agent sessions

The `.githooks/pre-commit` and `.githooks/pre-push` guards SHALL discriminate between **agent sessions** (automated tooling) and **human sessions** when deciding whether to block or reroute a commit/push on a protected branch (`main`, `dev`, `master`, or any branch configured via `multiagent.protectedBranches` / `GUARDEX_PROTECTED_BRANCHES`).

An **agent session** is any shell where at least one of these env vars is set to a truthy value: `CODEX_THREAD_ID`, `OMX_SESSION_ID`, `CODEX_CI=1`, `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`. All other sessions are **human sessions**.

#### Scenario: Human commits directly on a protected branch
- **WHEN** a human session (none of the agent env vars set) runs `git commit` with HEAD on `main`, `dev`, `master`, or any configured protected branch
- **THEN** the pre-commit hook exits 0 without running the auto-reroute or printing any `[agent-branch-guard]` / `[guardex-preedit-guard]` error
- **AND** the commit is created on the protected branch as the user requested

#### Scenario: Human pushes directly to a protected remote branch
- **WHEN** a human session runs `git push` whose refspec updates a protected remote branch
- **THEN** the pre-push hook exits 0 without emitting a "Push to protected branch blocked" error
- **AND** the push is delivered to the remote

#### Scenario: Claude Code session commits on a protected branch
- **WHEN** a shell with `CLAUDECODE=1` (or `CLAUDE_CODE_SESSION_ID` set) runs `git commit` with HEAD on a protected branch and `GUARDEX_AUTO_REROUTE_PROTECTED_BRANCH=0`
- **THEN** the pre-commit hook exits 1
- **AND** stderr contains `[agent-branch-guard] Direct commits on protected branches are blocked.`

#### Scenario: Claude Code session pushes to a protected branch
- **WHEN** a shell with `CLAUDECODE=1` (or `CLAUDE_CODE_SESSION_ID` set) runs `git push` that updates a protected remote branch
- **THEN** the pre-push hook exits 1
- **AND** stderr contains `[agent-branch-guard] Push to protected branch blocked.`

#### Scenario: Codex session retains existing behavior
- **WHEN** a shell with `CODEX_THREAD_ID` set runs `git commit` or `git push` targeting a protected branch
- **THEN** the pre-commit hook exits 1 with `[guardex-preedit-guard] Codex edit/commit detected on a protected branch.`
- **AND** the pre-push hook exits 1 with `[guardex-preedit-guard] Codex push detected toward protected branch.`
- **AND** the existing Codex-managed-only (AGENTS.md / .gitignore) carveout still applies.

#### Scenario: Existing escape hatches continue to work
- **WHEN** any session sets `ALLOW_COMMIT_ON_PROTECTED_BRANCH=1` or `ALLOW_PUSH_ON_PROTECTED_BRANCH=1`
- **THEN** the respective hook exits 0 regardless of session type.
