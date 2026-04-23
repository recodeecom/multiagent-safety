# Tasks

## 1. Spec
- [x] 1.1 Capture the prompt-replay checkpointing problem and intended guidance surfaces in `proposal.md`
- [x] 1.2 Define the prompt-guidance requirement in `spec.md`

## 2. Tests
- [x] 2.1 Extend focused prompt/snippet tests for checkpoint compaction wording

## 3. Implementation
- [x] 3.1 Tighten repo `AGENTS.md` token/context rules around checkpoints and transcript compaction
- [x] 3.2 Keep managed template parity in `templates/AGENTS.multiagent-safety.md`
- [x] 3.3 Extend `gx prompt` task-loop output with checkpoint and context-separation guidance

## 4. Verification
- [x] 4.1 Run focused prompt integration tests

## 5. Cleanup
- [x] 5.1 Commit with Lore protocol message
- [x] 5.2 Run `gx branch finish --branch "agent/codex/reduce-prompt-replay-checkpoint-guidance-2026-04-23-15-43" --base main --via-pr --wait-for-merge --cleanup`
- [x] 5.3 Record PR URL and final `MERGED` evidence

Cleanup evidence:
- PR: `https://github.com/recodeee/gitguardex/pull/375`
- Merge state: `MERGED` at `2026-04-23T13:48:25Z`
- Cleanup proof: source worktree no longer appears in `git worktree list` on the main checkout after `gx branch finish`
