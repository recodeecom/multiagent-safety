# T1 Notes

- Ship a clean follow-up release after `v7.0.10` failed its GitHub Actions release gate and left the npm deployment red.
- Stop the duplicate tag-push publish path so the npm environment only reflects the real release run (or an explicit manual dispatch).
- Bump the package metadata and README release notes together so the next publish can succeed without colliding with the already-published `7.0.10`.
