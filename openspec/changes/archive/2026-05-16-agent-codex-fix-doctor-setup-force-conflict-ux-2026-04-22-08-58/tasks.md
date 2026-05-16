## 1. Spec

- [x] 1.1 Define the targeted managed-file `--force` behavior in `specs/doctor-setup-force-targets/spec.md`.
- [x] 1.2 Capture the recovery UX problem and bounded scope in `proposal.md`.

## 2. Tests

- [x] 2.1 Add a regression that `gx doctor --force scripts/review-bot-watch.sh` rewrites the named managed shim instead of throwing `Unknown option`.
- [x] 2.2 Add a regression that `gx setup --force .github/workflows/cr.yml` rewrites the named managed template.
- [x] 2.3 Lock the conflict message so it teaches both targeted `--force <managed-path>` and global `--force`.

## 3. Implementation

- [x] 3.1 Extend the shared setup/doctor/install/fix arg parsing to accept managed path selectors only after `--force`.
- [x] 3.2 Route targeted force-path matching through the managed file/template rewrite helpers.
- [x] 3.3 Preserve the existing plain `--force` behavior for whole-surface rewrites.

## 4. Verification

- [x] 4.1 Run `node --check bin/multiagent-safety.js`.
- [x] 4.2 Run targeted install regressions in `test/install.test.js`.
- [x] 4.3 Run `openspec validate agent-codex-fix-doctor-setup-force-conflict-ux-2026-04-22-08-58 --type change --strict`.
- [x] 4.4 Run `openspec validate --specs`.

## 5. Cleanup

- [x] 5.1 Confirm the OpenSpec tasks reflect the shipped behavior and note any residual risk. Residual risk: targeted `--force` selectors intentionally fail fast for unlisted paths, and this worktree currently has no main specs for `openspec validate --specs` beyond the clean `No items found to validate.` result.
- [x] 5.2 Finish the agent branch via PR merge + cleanup (`gx finish --via-pr --wait-for-merge --cleanup` or `bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup`).
- [x] 5.3 Record PR URL + final `MERGED` evidence in the completion handoff.
