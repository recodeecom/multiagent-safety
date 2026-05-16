# T1 Notes

- Color `gx doctor` failure lines red so blocked auto-finish rows are visible in long recursive runs.
- Color doctor success lines green, including `No safety issues detected.` and `Repo is fully safe.`, while keeping non-TTY output unchanged.
- Add a regression that forces ANSI output and proves doctor renders colors for both failure and success status lines.
