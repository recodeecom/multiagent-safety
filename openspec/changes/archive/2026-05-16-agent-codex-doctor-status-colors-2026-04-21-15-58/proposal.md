## Why

- `gx doctor` already prints compact actionable statuses, but the success and failure lines all use the same default terminal color and are easy to miss in long recursive runs.
- Auto-finish failures are the most actionable doctor output, yet they visually blend into the surrounding safe scan output.
- The CLI needs a deterministic way to emit ANSI colors during automated verification so status-color regressions can be tested.

## What Changes

- Color human-readable `gx doctor` success lines green.
- Color doctor failure lines red and skip/pending lines yellow.
- Honor the standard `FORCE_COLOR` environment variable so ANSI output can be verified in tests without changing non-color output defaults.

## Impact

- Affects only the human-readable doctor/status CLI output when ANSI colors are enabled.
- JSON output and non-color terminals remain unchanged.
- Main risk: over-coloring could reduce readability, so the change stays scoped to doctor scan/final status lines and auto-finish summary/detail rows.
