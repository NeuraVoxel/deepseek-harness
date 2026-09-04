---
name: data-contract-review
description: Review or author changes to schemas/, fixtures/, dataset revisions, lineage, or integration payload shapes on the data-loop platform.
---

# Data contract review

## Rules

1. **Single source of truth:** Contracts live under `schemas/<name>/vN.json` (JSON Schema). Runtime code may generate types from them; do not fork a second hand-written authority.
2. **Compatibility:** Same major `vN` may add optional fields. Removing/renaming/changing meaning requires `vN+1` and an Agent Note.
3. **Fixtures:** Every schema version used in CI has at least one fixture under `fixtures/` that `scripts/verify_schemas.py` validates.
4. **Revisions:** Catalog objects referenced by training/eval/export use immutable revision ids. Parsers and bridges write new revisions; they do not mutate old ones.
5. **Lineage:** When a revision is derived, record parent revision ids in the payload or catalog metadata (MVP: `parent_revision_ids` on dataset revisions).

## Commands

```sh
make check-schemas
python3 scripts/verify_schemas.py
```

## Review checklist

- [ ] Schema path version matches intent (compat vs break)
- [ ] Fixture updated and verifier green
- [ ] Note updated if the contract decision is non-trivial
- [ ] Adapters/docs point at the new version, not "latest"
