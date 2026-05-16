## 1. Specification

- [x] 1.1 Finalize proposal scope and acceptance criteria for `agent-claude-frontend-how-it-works-design-match-2026-04-20-11-02`.
- [x] 1.2 Define normative requirements in `specs/frontend-how-it-works-design-match/spec.md`.

## 2. Implementation

- [x] 2.1 Rewrite `frontend/app/globals.css` to match the Claude Design handoff tokens + layout (flush 100vh shell, VS Code chrome, tree view, dev-pull animation, status bar).
- [x] 2.2 Rewrite `frontend/app/page.tsx` so each mode's step array declaratively drives the chat labels (`✦ thinking`, `□ proposed phases`), worktree tree with commit CTA, diff gutter, typing caret, and pull animation.

## 3. Verification

- [x] 3.1 `npx tsc --noEmit -p .` (passes, no type errors).
- [x] 3.1.a `npx next build` (compiled successfully, 4/4 static pages, `/` bundle 11.2 kB / 128 kB First Load).
- [x] 3.2 Run `openspec validate agent-claude-frontend-how-it-works-design-match-2026-04-20-11-02 --type change --strict` (PASS: `Change ... is valid`).
- [x] 3.3 Run `openspec validate --specs` (PASS: no items to validate; no top-level specs touched).

## 4. Collaboration

- [x] 4.1 N/A — no joined codex agents on this helper branch; owner == executor.

## 5. Cleanup

- [x] 5.1 Run `bash scripts/agent-branch-finish.sh --branch agent/claude/frontend-how-it-works-design-match-2026-04-20-11-02 --base main --via-pr --wait-for-merge --cleanup`.
- [x] 5.2 Record PR URL + final merge state in the completion handoff.
- [x] 5.3 Confirm the sandbox worktree has been pruned (`git worktree list` clean).
