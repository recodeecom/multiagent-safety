# agent-codex-fix-doctor-sandbox-cleanup-2026-04-23-17-49 (minimal / T1)

Branch: `agent/codex/fix-doctor-sandbox-cleanup-2026-04-23-17-49`

`gx doctor` already merges protected-branch sandbox repairs through `gx branch finish --cleanup`, but the doctor flow runs that finisher from inside the sandbox worktree. That leaves the just-merged doctor sandbox attached as the active cwd, so the finisher cannot prune the worktree even though the merge succeeded.

Scope:
- Run the doctor sandbox finish flow from the protected repo root instead of the sandbox cwd.
- Verify successful doctor auto-finish leaves no surviving local sandbox branch/worktree.
- Add a focused regression that proves the sandbox worktree path disappears after merge cleanup.

Verification:
- `node --test test/doctor.test.js --test-name-pattern "doctor on protected main auto-commits sandbox repairs and runs PR finish flow when gh is authenticated"`
- `node --test test/doctor.test.js --test-name-pattern "doctor on protected main fails when sandbox PR is not merged"`
