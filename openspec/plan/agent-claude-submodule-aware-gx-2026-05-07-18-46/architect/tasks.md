# architect tasks — submodule-aware gx

> **Role goal**: turn the spec into an implementable shape. Pick
> data structures, decide where new code lives, choose the
> dependency graph between scripts, and document the failure
> modes the executor must handle.

## Scope boundary

In scope:
- shape of `scripts/agent-submodules.py` (functions, return types,
  invariants)
- shape of `.guardex/submodules.json` (manifest schema)
- shape of the new lock-record tuple in `agent-file-locks.py`
- shape of `gx submodules` subcommand routing
- failure mode catalog (what happens on each failure → which
  recovery path)

Out of scope:
- writing implementation code (executor)
- writing tests (executor authors, critic reviews)

## 1. Spec
- [ ] 1.1 Enumerate every state transition for a submodule across
       its lifecycle: `unknown → uninitialized → init → clean →
       dirty → committed → pushed → pr-open → pr-merged →
       gitlink-bumped`. Identify which step is allowed to fail
       silently.
- [ ] 1.2 Author the manifest schema. Required keys: `name`,
       `path`, `url`, `branch`, `state`, `was_uninitialized`,
       `parent_gitlink_sha`, `child_branch`, `child_pr_url`,
       `child_pr_state`, `permission`, `host`, `mode`,
       `parent_bump`, `reason`.

## 2. Tests
- [ ] 2.1 Confirm the failure catalog has a corresponding negative
       test in `tasks.md §2`. Add any missing entries.

## 3. Implementation
- [ ] 3.1 Choose: should `agent-submodules.py` shell out to `git`
       or use `dulwich`/`pygit2`? Record reasoning. (Default:
       shell out to `git` via `subprocess.run`; matches existing
       script style.)
- [ ] 3.2 Choose the locking strategy when an agent edits across
       parent + submodule in the same task: separate claims, or
       one combined claim with a `repo` segment per file? Record
       reasoning. (Default: separate claim per `(repo, path)`.)
- [ ] 3.3 Author `failure-modes.md` (sibling of this file) listing
       every failure → user-facing message → recovery command.
- [ ] 3.4 Approve or reject the proposed `GUARDEX_SUBMODULE_MODE`
       and `GUARDEX_SUBMODULE_INIT` env-var contract.

## 4. Checkpoints
- [ ] 4.1 Publish architect checkpoint after the manifest schema
       and failure catalog land.

## Handoff fields

```
branch=agent/claude/submodule-aware-gx-2026-05-07-18-46
task=architect
blocker=<empty when done>
next=critic | executor
evidence=openspec/plan/<slug>/architect/failure-modes.md, manifest schema in proposal.md
```
