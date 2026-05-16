## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-frontend-guardex-brand-copy-doctor-2026-04-20-11-44`.
- [x] 1.2 Define normative requirements in `specs/frontend-guardex-brand-copy-doctor/spec.md` (GuardeX brand block + shell-row copy button + realistic gx doctor transcript).

## 2. Implementation

- [x] 2.1 Add the GuardeX brand block (inline T-Rex SVG mark, `GuardeX` title, accent-green italic tagline) with `.brand-divider` between it and the existing "How it works" block.
- [x] 2.2 Add `ToolRowCopyBtn` + `.t-copy` styles, render it only on `shell` rows, and wire clipboard with execCommand fallback + 1.4s icon swap.
- [x] 2.3 Replace the synthetic `gx doctor` output in Installation Step 02 with a realistic transcript (doctor/fix summary, hooksPath line, safety-check success, auto-finish sweep, skip/fail rows).
- [x] 2.4 Import `type MouseEvent as ReactMouseEvent` from `'react'` so the new handler typechecks without a namespace import.

## 3. Verification

- [x] 3.1 `npx tsc --noEmit -p .` — PASS (no type errors).
- [x] 3.1.a `npx next build` — PASS (`/` bundle 13.8 kB / 131 kB First Load, 4/4 static pages).
- [x] 3.2 `openspec validate <change> --type change --strict` — PASS.
- [x] 3.3 `openspec validate --specs` — PASS (no top-level specs touched).

## 4. Collaboration

- [x] 4.1 N/A — single-owner helper branch, no joined codex agents.

## 5. Cleanup

- [x] 5.1 Run `bash scripts/agent-branch-finish.sh --branch agent/claude/frontend-guardex-brand-copy-doctor-2026-04-20-11-44 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 5.2 Record PR URL + final merge state in the completion handoff.
- [x] 5.3 Confirm sandbox worktree pruned and no dangling refs.
