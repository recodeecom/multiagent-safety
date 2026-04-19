## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-port-role-datetime-branch-naming-2026-04-20-01-06`.
- [x] 1.2 Define normative requirements in `specs/port-role-datetime-branch-naming/spec.md`.

## 2. Implementation

- [x] 2.1 Port `templates/scripts/agent-branch-start.sh` from recodee:71c0dc114 (normalize_role + role-datetime branch naming + `--print-name-only` + `--tier`).
- [x] 2.2 Rewrite `test/install.test.js` tests 32/33/34 (old snapshot-slug assertions → new role-datetime assertions).
- [x] 2.3 Add v7.0.1 / v7.0.2 / v7.0.3 release notes to `README.md`.
- [x] 2.4 Bump `package.json` 7.0.2 → 7.0.3.

## 3. Verification

- [x] 3.1 `bash -n templates/scripts/agent-branch-start.sh` (syntax OK).
- [x] 3.2 Smoke test: `--print-name-only` emits `agent/{claude,codex,<override>}/<task>-<YYYY-MM-DD>-<HH-MM>` for three representative inputs.
- [x] 3.3 `openspec validate agent-claude-port-role-datetime-branch-naming-2026-04-20-01-06 --type change --strict`.
- [x] 3.4 `node --test test/install.test.js` — three rewritten v7.0.3 tests pass (3/3).
- [x] 3.5 Regression delta vs baseline `main`: +4 known regressions (`27`, `38`, `70`, `72`) flagged in proposal as follow-up; tests 32/33/34 go from fail→pass.

## 4. Cleanup

- [x] 4.1 Run `scripts/agent-branch-finish.sh --branch agent/claude/port-role-datetime-branch-naming-2026-04-20-01-06 --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox worktree is removed (`git worktree list` shows no entry; `git branch -a` shows no surviving refs).
