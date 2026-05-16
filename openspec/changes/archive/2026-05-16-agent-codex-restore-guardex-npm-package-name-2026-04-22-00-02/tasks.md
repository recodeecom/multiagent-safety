## 1. Spec

- [x] 1.1 Capture why the npm package rename has to revert and the versioning constraint for the next publish.

## 2. Tests

- [x] 2.1 Update the package-name-dependent install/self-update/status assertions back to `@imdeadpool/guardex`.

## 3. Implementation

- [x] 3.1 Restore package metadata to `@imdeadpool/guardex` and bump the package version to `7.0.17`.
- [x] 3.2 Refresh README, tutorial, Reddit kit, and README-linked assets to reference `@imdeadpool/guardex`.

## 4. Verification

- [x] 4.1 Run targeted package-name verification (`node --test --test-name-pattern "(default invocation checks for update and can auto-approve latest install|self-update verifies on-disk version after @latest install and retries with pinned version when stale|self-update restarts into the installed CLI after a successful on-disk upgrade|status --json returns cli, services, and repo summary|prompt outputs AI setup instructions|prompt --exec outputs command-only checklist|deprecated copy-commands alias still works and warns)" test/install.test.js`, `node --check bin/multiagent-safety.js`, `npm pack --dry-run`) and record the results. Result: targeted package-name verification passed `7/7`; `node --check bin/multiagent-safety.js` passed; `npm pack --dry-run` produced `imdeadpool-guardex-7.0.17.tgz`.
- [x] 4.2 Run `openspec validate agent-codex-restore-guardex-npm-package-name-2026-04-22-00-02 --type change --strict`. Result: `Change 'agent-codex-restore-guardex-npm-package-name-2026-04-22-00-02' is valid`.
- [x] 4.3 Run `openspec validate --specs`. Result: `No items found to validate.`
- [x] 4.4 Run `npm test` after the package-name revert to confirm broader repo integrity. Result: full suite passed `163/163`.

## 5. Cleanup

- [x] 5.1 Finish branch via PR merge + cleanup and record final `MERGED` evidence.
