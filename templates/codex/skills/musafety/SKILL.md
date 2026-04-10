---
name: musafety
description: "Use when you need to check, repair, or bootstrap multi-agent safety guardrails in this repository."
---

# musafety (Codex skill)

Use this skill whenever branch safety, lock ownership, or guardrail setup may be broken.

## Fast path

1. Run `musafety status`.
2. If repo safety is degraded, run `musafety doctor`.
3. If issues remain, run `musafety scan` and address the findings.

## Setup path

If guardrails are missing entirely, run:

```sh
musafety setup
```

Then verify:

```sh
musafety status
musafety scan
```

## Operator notes

- Prefer `musafety doctor` for one-step repair + verification.
- Keep agent work isolated (`agent/*` branches + lock claims).
- Do not bypass protected branch safeguards unless explicitly required.
