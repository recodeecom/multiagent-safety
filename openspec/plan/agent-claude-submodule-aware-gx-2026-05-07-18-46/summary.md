# Plan Summary: submodule-aware gitguardex

- **Mode:** opsx (T3 plan workspace)
- **Status:** drafted

## Context

Today the gx lifecycle (`scripts/agent-branch-start.sh`,
`agent-branch-finish.sh`, `agent-file-locks.py`, `codex-agent.sh`)
contains zero references to git submodules, even though
`.gitmodules` configures five of them in this repo. As a result,
agent edits inside `examples/hive`, `examples/skills_for_claude`,
etc. land on disk but never reach the submodule's remote, and the
parent's gitlink is never bumped. Current observable evidence:
`git submodule status` reports three submodules as `-` prefixed
(uninitialized) while `git status` reports `m` (modified)
for the same paths — stranded edits with no commit path.

This change makes the lifecycle submodule-aware:
- detect at `branch start`
- claim per `(submodule_root, relative_path)`
- per-submodule commit→push→PR→merge cycle on `branch finish`
- atomic gitlink bump in **one** parent commit only after every
  child PR reaches `MERGED`
- preflight `GITHUB_TOKEN` write permission for every github.com
  submodule remote
- per-submodule `openspec validate` only when that submodule has
  its own `openspec/`

## Decisions

- **Default mode**: `full-pr` — every dirty submodule gets its own
  PR cycle. Operator can override via `GUARDEX_SUBMODULE_MODE`
  to `off | sync-only | commit-only | full-pr`.
- **Auto-init**: on by default; opt-out via
  `GUARDEX_SUBMODULE_INIT=0`.
- **Lock keying**: `(submodule_root, relative_path)` tuple;
  legacy bare-path entries remain readable.
- **Atomic bump**: parent stages all gitlink updates in a single
  `chore(submodules): bump gitlinks for <slug>` commit, only
  after all child PRs reach `MERGED`. Partial failure → no
  parent bump, BLOCKED handoff.
- **gx submodules subcommand**: `status` and `preflight` ship in
  this PR; richer subcommands (`list`, `pin`, `bump`) deferred
  unless planner upgrades the scope.

## Quality Risks

- Multi-org token: submodules span `NagyVikt` and `recodeee` orgs;
  a token without write to one of them silently breaks finish.
  Mitigation: preflight at `branch start` (§V Requirement 4).
- Wait-for-merge fan-out: 5 submodules × 5 protected-branch
  dances. Mitigation: shared poller, fail-fast preflight.
- Atomic bump failure surface: rollback is the executor's
  hardest step. Mitigation: parent never receives an
  intermediate commit; the bump commit is the only one.

## Verification Snapshot

Pending — verifier role records command outputs here.

## Handoff Notes

- Helper sub-branches MUST NOT create their own OpenSpec change
  artifacts (per AGENTS.md owner-branch rule).
- After archive, write
  `openspec/specs/gitguardex-submodules/context.md` capturing
  rationale, decisions, and at least one concrete walkthrough.
