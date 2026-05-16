# Optimize gx guidance for RTK command wrappers

## Why

Guardex already pushes agents toward compact, phase-based execution, but `gx prompt`
and managed AGENTS snippets do not name the concrete RTK command surface. Agents
therefore fall back to raw `git`, `rg`, test, and build commands even when RTK is
available, increasing terminal output and context load.

## What

- Add RTK command-compression guidance to the `gx prompt` checklist.
- Add the same rule to the managed multi-agent AGENTS snippet so `gx setup`/`gx doctor`
  can propagate it to guarded repos.
- Keep internal `gx` machine-readable git/process calls raw so RTK filtering cannot
  break parsed stdout contracts.

## Impact

Agents get concrete RTK examples for file discovery, git/GitHub, tests, builds,
logs, and savings analytics while existing scripted Guardex behavior remains
compatible when RTK is not installed.
