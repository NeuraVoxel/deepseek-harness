---
name: pre-push-checks
description: Before pushing, marking ready for review, or claiming checks pass — select the smallest tests and verifiers that cover the outgoing diff; do not reflexively run the full suite.
---

# Pre-push checks

CI owns the exhaustive matrix. Locally, run relevant evidence once.

## Inspect scope

```sh
git status --short --branch
git diff --stat <base>...HEAD
```

Use the PR base or trunk (`main` / `master`) as `<base>`.

## Select evidence

| Diff touches | Run |
|---|---|
| `schemas/**` or `fixtures/**` | `make check-schemas` |
| `pipelines/**` | `make test` (or a focused `pytest` path) |
| Agent notes | `python3 scripts/verify_agent_notes.py` |
| Docs only | Link/readability review; no need for full pytest unless docs claim commands |
| Apps / packages (when filled in) | That language's unit tests and typecheck |

Default MVP one-liner when unsure:

```sh
make check
```

Do not re-run a check that already passed for the same diff unless the diff changed again.

## Failures

Fix or explain blockers before push. Do not push hoping CI differs for schema or unit failures.
