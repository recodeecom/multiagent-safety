## 1. Spec

- [x] 1.1 Capture why Guardex prompt surfaces should blame long fragmented runs, not low output alone.

## 2. Implementation

- [x] 2.1 Update `AGENTS.md` with the bounded-vs-fragmented classifier and stop-loop guidance.
- [x] 2.2 Update `src/context.js` task-loop prompt text to push inspect-once / patch-once / verify-once execution.
- [x] 2.3 Update `test/prompt.test.js` to lock the new prompt wording.

## 3. Verification

- [x] 3.1 Run `node --test test/prompt.test.js`.
- [x] 3.2 Run `openspec validate --specs`.

Verification evidence:
- `node --test test/prompt.test.js` (pass)
- `openspec validate --specs` (no items found to validate)

## 4. Cleanup

- [ ] 4.1 Commit, push, open/update PR, merge, and clean up the worktree.
