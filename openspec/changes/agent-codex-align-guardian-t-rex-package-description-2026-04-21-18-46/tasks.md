## 1. Metadata

- [x] 1.1 Update `package.json` so the npm description matches the canonical Guardian T-Rex copy.
- [x] 1.2 Restore the README GitHub About section so it links to `about_description.txt` and mirrors the canonical copy.
- [x] 1.3 Restore the README solution visual expected by the existing metadata/about regression.

## 2. OpenSpec

- [x] 2.1 Record the scope and handoff in the change notes.
- [x] 2.2 Add a spec delta covering package metadata alignment with `about_description.txt`.

## 3. Verification

- [x] 3.1 Validate `package.json` parses as JSON.
- [x] 3.2 Run `git diff --check`.
- [x] 3.3 Update/add regression coverage for canonical About copy alignment.
- [x] 3.4 Run `npm test`.
- [x] 3.5 Run `openspec validate agent-codex-align-guardian-t-rex-package-description-2026-04-21-18-46 --type change --strict`.
- [x] 3.6 Run `openspec validate --specs`.

## 4. Cleanup

- [ ] 4.1 Run `bash scripts/agent-branch-finish.sh --branch "agent/codex/align-guardian-t-rex-package-description-2026-04-21-18-46" --base main --via-pr --wait-for-merge --cleanup`.
- [ ] 4.2 Record PR URL + final `MERGED` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (`git worktree list`, `git branch -a`) or capture a `BLOCKED:` handoff if merge/cleanup is pending.
