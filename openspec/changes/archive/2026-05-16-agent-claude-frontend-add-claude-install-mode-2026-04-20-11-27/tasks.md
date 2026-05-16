## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-frontend-add-claude-install-mode-2026-04-20-11-27`.
- [x] 1.2 Define normative requirements in `specs/frontend-add-claude-install-mode/spec.md` (install pill + Installation mode + Claude parallel lane).

## 2. Implementation

- [x] 2.1 Add `INSTALL_COMMAND` constant, copyable install pill (`.install-pill`) in the top bar with clipboard + fallback, icon swap, and "copied" toast.
- [x] 2.2 Extend `ModeKey`/`MODE_ORDER`/`ModeConfig.dotClass` with `installation`/`'i'` and register `INSTALL_STEPS` (5 steps: install → doctor → setup → start → finish with dev-pull).
- [x] 2.3 Update Execute mode Step 06/07 second worktree to `agent_claude__projects-hydration-mismatch-sidebar` on `agent/claude/...`, tagged `claude · parallel`, with copy that names Claude running alongside Codex.
- [x] 2.4 Add `.dotc.i` (blue) accent, `.install-pill` styles, and `copy` icon.

## 3. Verification

- [x] 3.1 `npx tsc --noEmit -p .` — PASS (no type errors).
- [x] 3.1.a `npx next build` — PASS (`/` bundle 13.2 kB / 130 kB First Load, 4/4 static pages; ESLint gate green after escaping inline `"` in `<code>` copy).
- [x] 3.2 `openspec validate <change> --type change --strict` — PASS.
- [x] 3.3 `openspec validate --specs` — PASS (no top-level specs touched).

## 4. Collaboration

- [x] 4.1 N/A — single-owner helper branch, no joined codex agents.

## 5. Cleanup

- [x] 5.1 Run `bash scripts/agent-branch-finish.sh --branch agent/claude/frontend-add-claude-install-mode-2026-04-20-11-27 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 5.2 Record PR URL + final merge state in the completion handoff.
- [x] 5.3 Confirm sandbox worktree pruned and no dangling refs.
