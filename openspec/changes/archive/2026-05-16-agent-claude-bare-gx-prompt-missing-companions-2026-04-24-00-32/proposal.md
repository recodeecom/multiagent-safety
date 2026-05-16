## Why

- Bare `gx` already surfaces `Optional companion tools inactive: cavekit, caveman` but it stops at pointing the user at `gx setup` — the user still has to remember the subcommand, re-read the banner, and decide whether the prompt is worth it.
- Users have asked for an inline Y/N prompt: detect missing global companions (`oh-my-codex`, `oh-my-claudecode`, `@fission-ai/openspec`, `cavemem`, `@imdeadpool/codex-account-switcher`, `cavekit`, `caveman`) and offer "install now?" directly on `gx` / `gx status`.
- `gx setup` already has the full prompt + install pipeline (`askGlobalInstallForMissing` → `promptYesNoStrict` → `npm i -g …` / `npx …`). Bare `gx` just needs to reuse it.

## What Changes

- **`src/toolchain/index.js`**:
  - Extract the install loop from `installGlobalToolchain(options)` into a new exported `performCompanionInstall(missingPackages, missingLocalTools)` so `status(...)` can run the install directly without triggering the setup preamble (`Already installed globally: …`).
  - Export `buildMissingCompanionInstallPrompt` so the prompt wording stays consistent between `gx setup` and bare `gx`.
- **`src/cli/main.js`**:
  - Factor the service-detection block inside `status(rawArgs)` into `collectServicesSnapshot()` so the banner can re-run it after an install and render the updated service states.
  - Add `maybePromptInstallMissingCompanions(snapshot)`:
    - Skip silently when `GUARDEX_SKIP_COMPANION_PROMPT` is set, when stdout/stdin isn't a TTY, or when nothing is missing.
    - Honor `GUARDEX_AUTO_COMPANION_APPROVAL` (yes/no) in non-interactive paths (symmetric with `GUARDEX_AUTO_UPDATE_APPROVAL`).
    - Print `[gitguardex] Missing companion tools: <names>.`, then run `promptYesNoStrict(buildMissingCompanionInstallPrompt(...))`.
    - On approval, call `performCompanionInstall(...)` and report success/failure. On decline, print a one-line opt-out hint pointing at `GUARDEX_SKIP_COMPANION_PROMPT=1` or `gx setup --install-only`.
  - Invoke `maybePromptInstallMissingCompanions(snapshot)` before the banner renders; if the install succeeded, re-run `collectServicesSnapshot()` so the collapsed/expanded services list and the `Next:` hint reflect the newly installed tools.
- **`test/status.test.js`**: update the `GUARDEX_AUTO_DOCTOR=yes` test expectation to match the `--current` upgrade from the previous change (regex was pinned to the pre-upgrade wording).

## Impact

- Affected runtime surfaces:
  - `src/toolchain/index.js` — new exports (`performCompanionInstall`, `buildMissingCompanionInstallPrompt`); no change for existing callers.
  - `src/cli/main.js` — `status(...)` prompts for companion install before rendering when interactive and not opted out; JSON path and non-interactive runs keep the existing output verbatim.
- Affected regression coverage:
  - `test/status.test.js` — one regex refresh for the auto-doctor path.
  - Existing bare-gx TTY-gated tests continue to pass because tests don't provide a TTY stdin, so the new prompt branch is skipped.
- Risk: low. No new behavior in non-TTY / JSON / CI paths. The install itself already has an explicit Y/N gate; the banner change only makes the gate reachable without running `gx setup` first.
