## Why

- The Active Agents companion currently installs into a versioned VS Code extension directory and deletes older patch directories on each update.
- VS Code keeps patch-specific extension locations cached across already-open windows, so pruning those directories can leave one window showing `Active Agents Commit` while another window can no longer resolve the companion until reload.

## What Changes

- Install the Active Agents companion into one canonical local extension directory derived from the extension id.
- Refresh a bounded same-major/minor patch compatibility window so already-open windows that still hold a recent older patch path can keep resolving the extension until reload.
- Update the installer output to tell the user to reload each already-open VS Code window after install/update.
- Add focused regression coverage for the new install layout.

## Impact

- Affects only the local VS Code companion install surface under `~/.vscode/extensions` plus installer regression tests.
- Keeps a small bounded set of patch compatibility copies to avoid stale-window breakage during rapid local iteration.
- Does not change the runtime feature set of the extension itself.
