## Why

- `gx setup` currently finishes a fresh-repo bootstrap with generic OpenSpec links only, even when the repo still has no commits and no `origin` remote. That leaves the user with the safety files installed but no concrete "what do I do next?" guidance.
- On an empty repo, the setup scan currently prints `Branch: (unknown)` instead of the actual unborn branch name, which makes the first-run output feel rough.
- Compose-based repos often need a small wrapper for running Guardex-adjacent commands inside the app container, but setup does not currently scaffold one.

## What Changes

- Show the real unborn branch name during setup/scan and add a fresh-repo onboarding block with the bootstrap commit, first agent branch flow, and missing-remote hint.
- Add a managed `scripts/guardex-docker-loader.sh` helper plus the matching `package.json` script so new repos get the Docker entry point immediately.
- Surface the Docker loader in setup output only when a compose file is present, and add regression coverage for the fresh-repo + Docker bootstrap path.

## Impact

- Affected surfaces:
  - `bin/multiagent-safety.js`
  - `scripts/guardex-docker-loader.sh`
  - `templates/scripts/guardex-docker-loader.sh`
  - `test/install.test.js`
  - `README.md`
- Risk is low and scoped to setup/bootstrap output plus one new helper script.
