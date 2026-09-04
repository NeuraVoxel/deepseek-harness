# AGENTS.md — Data Loop Platform

Standing orders for contributors and coding agents. Product docs live under `docs/`; decision rationale lives under `.agents/notes/`.

## Product scope

Data closed loop: upload → parse → catalog → visualize / dataset export; bridges to annotation, algorithm, evaluation, training, and fine-tuning systems. Integrations use versioned schemas and adapters — never deep cross-module imports.

## Non-trivial changes need an Agent Note

Add or update a note under `.agents/notes/{proposed,implemented,rejected}/` in the same PR when behavior, schemas, integrations, process, or testing strategy change. Mechanical renames and typo fixes are exempt. Format: see `.agents/notes/README.md`.

## Checks: relevant locally, exhaustive in CI

- **pre-commit / lefthook:** cheap defects only (see `lefthook.yml`).
- **Before push / ready for review:** run the narrowest evidence for the diff (skill: `.agents/skills/pre-push-checks/SKILL.md`). Do not default to the full matrix.
- **CI:** owns schema verification and the language test lanes in `.github/workflows/ci.yml`.

```sh
make check              # schemas + unit tests (MVP default)
make check-schemas      # schemas/ + fixtures only
make test               # pytest
```

## PR policy

- Split independent changes; stack dependent layers when review size needs it: **schema → service/pipeline → UI/trigger → adapter**.
- Prefer one vertical slice (contract through UI) over long-lived "frontend agent" vs "backend agent" splits.
- Labels (suggested): one `kind/*` and at least one `area/*` (`area/catalog`, `area/parse`, `area/viz`, `area/bridge-annot`, `area/bridge-train`, `area/infra`, …).

## Secrets

Never commit credentials, vehicle PII, or raw customer bags. Use environment variables or a secret manager. Optional real-data / live-bridge jobs must self-skip without credentials.

## Layout

```text
apps/           # api, web, workers (placeholders in MVP)
packages/       # shared libraries and adapters (placeholder)
pipelines/      # Python parse and batch jobs
schemas/        # versioned data contracts (source of truth)
fixtures/       # small closed-loop examples for CI
.agents/        # notes + skills
docs/           # architecture, development, testing, integrations
```
