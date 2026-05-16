## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-add-omc-gitignore-and-oh-my-claude-statu-2026-04-20-09-28`.
- [x] 1.2 Define normative requirements in `specs/add-omc-gitignore-and-oh-my-claude-status/spec.md`.

## 2. Implementation

- [x] 2.1 Add `'oh-my-claude'` to `GLOBAL_TOOLCHAIN_PACKAGES` in `bin/multiagent-safety.js`.
- [x] 2.2 Add `'.omc/'` to `MANAGED_GITIGNORE_PATHS` in `bin/multiagent-safety.js`, immediately after `'.omx/'`.
- [x] 2.3 Extend the managed-`.gitignore` assertion block in `test/install.test.js` to require `.omc/`.
- [x] 2.4 Bump `package.json` version 7.0.4 → 7.0.5.
- [x] 2.5 Add `### v7.0.5` release notes to `README.md` summarizing both additions.

## 3. Verification

- [x] 3.1 Targeted tests pass: `node --test --test-name-pattern="gitignore|status.*json" test/install.test.js` → 4/4 pass.
- [x] 3.2 `openspec validate agent-claude-add-omc-gitignore-and-oh-my-claude-statu-2026-04-20-09-28 --type change --strict`.
- [x] 3.3 Manual sanity: `gx status --json` still emits a services array (generic assertion preserved in existing test).

## 4. Cleanup

- [ ] 4.1 Run `scripts/agent-branch-finish.sh --branch agent/claude/add-omc-gitignore-and-oh-my-claude-statu-2026-04-20-09-28 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 4.2 Record PR URL + `MERGED` state and confirm sandbox worktree removed.
