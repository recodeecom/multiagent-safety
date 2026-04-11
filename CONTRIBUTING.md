# Contributing

Thanks for contributing to `GuardeX`.

## Development setup

```bash
npm ci
npm test
node --check bin/multiagent-safety.js
npm pack --dry-run
```

## Pull request checklist

- Keep changes small and focused
- Add or update tests for behavior changes
- Keep README and CLI help text aligned
- Ensure `npm test` passes locally

## Release hygiene

- Keep `main` green (CI passing)
- Prefer trusted publishing (`npm publish --provenance`)
- Use a clean working tree and tag-based releases when possible
