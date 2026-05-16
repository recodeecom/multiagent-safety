## Why

- Ralplan-created planning lanes need a visible `masterplan` identity in the
  sandbox worktree and OpenSpec plan folder so the owner branch is easy to find
  in VS Code and hand off to joined agents.
- Plan role folders need copyable prompts and explicit ownership/completion
  checklists so helpers can reuse the same owner worktree instead of spinning up
  unrelated branches.

## What Changes

- Prefix plan-backed worktree and plan-workspace identities with
  `masterplan` while leaving branch names and change slugs stable.
- Extend the plan scaffold so each role gets a default `prompt.md` plus
  ownership, collaboration, and cleanup-blocking checklist items.
- Keep `codex-agent.sh` aligned with the new naming so both the normal launch
  path and the fallback sandbox path preserve the same `masterplan` labeling.

## Impact

- Touches Guardex runtime/template helper scripts and their regression suite.
- Existing branches are unaffected; only newly created plan-backed sandboxes get
  the new worktree/plan naming.
- Cleanup still stays on the owner change lane; role prompts now make that
  explicit for joined helpers.
