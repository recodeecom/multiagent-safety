## Why
Guardex installs a managed AGENTS block, but it does not currently tell downstream repos when to stay lightweight versus when to invoke heavier OMX orchestration. That makes small asks burn unnecessary orchestration tokens even when Caveman/direct mode is enough.

## What Changes
- Add a task-size routing clause to the managed Guardex AGENTS template.
- Keep small, bounded asks in direct caveman-only mode by default.
- Reserve heavy OMX modes for medium/large scope and allow explicit lightweight escape-hatch prefixes.

## Impact
- Repos bootstrapped or refreshed by `gx setup` / `gx doctor` get a clearer default routing policy.
- Small asks stay cheaper and simpler.
- Larger, cross-cutting work still has an explicit path into OMX orchestration.
