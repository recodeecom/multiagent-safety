## 1. Spec

- [x] 1.1 Capture the npm-package rename scope and compatibility posture.

## 2. Tests

- [x] 2.1 Update targeted install/self-update/status expectations for the renamed package.

## 3. Implementation

- [x] 3.1 Rename the published package metadata to `@imdeadpool/gitguardex`.
- [x] 3.2 Refresh CLI install prompts and package-name-dependent surfaces.
- [x] 3.3 Refresh README, tutorial/docs copy, and README-linked assets to use GitGuardex npm/install wording.

## 4. Verification

- [x] 4.1 Run renamed-package verification (`node --test --test-name-pattern "(self-update verifies on-disk version after @latest install and retries with pinned version when stale|self-update restarts into the installed CLI after a successful on-disk upgrade|status --json returns cli, services, and repo summary|prompt outputs AI setup instructions|prompt --exec outputs command-only checklist|deprecated copy-commands alias still works and warns)" test/install.test.js`, `node --check bin/multiagent-safety.js`, `npm pack --dry-run`). Result: targeted renamed-package tests passed `6/6`; `node --check bin/multiagent-safety.js` passed; `npm pack --dry-run` produced `imdeadpool-gitguardex-7.0.16.tgz`.
- [x] 4.2 Run `openspec validate agent-codex-rename-npm-package-to-gitguardex-everywh-2026-04-21-21-02 --type change --strict`. Result: `Change 'agent-codex-rename-npm-package-to-gitguardex-everywh-2026-04-21-21-02' is valid`.
- [x] 4.3 Run `openspec validate --specs`. Result: `No items found to validate.`

## 5. Cleanup

- [ ] 5.1 Finish branch via PR merge + cleanup and record final `MERGED` evidence.
