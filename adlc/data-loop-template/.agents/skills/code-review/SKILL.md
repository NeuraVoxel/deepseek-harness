---
name: code-review
description: Review a pull request on the data-loop platform — prioritize correctness of data contracts, lineage, idempotent jobs, security, and required evidence over style.
---

# Code review

## Sources of truth

- Root `AGENTS.md`
- `.agents/notes/` for design decisions
- `schemas/` for wire and asset contracts
- `.agents/skills/data-contract-review/SKILL.md` when schemas or fixtures change

## Blocking checks

1. **Schema and lineage:** Breaking schema changes bump the major version path and include a note. Dataset revisions stay immutable; no "latest directory" dependencies.
2. **Jobs:** Parse/ingest paths are idempotent or explicitly supersede; failures are reproducible from logs + input revision.
3. **Integrations:** Bridges use adapters + contract fixtures; PR tests must not require live annotation/GPU clusters.
4. **Evidence:** Author ran relevant checks for the diff (`pre-push-checks` skill). CI green does not replace semantic review of contracts.
5. **Secrets / PII:** No credentials or raw sensitive bags in the tree; exports need audit hooks when implemented.

## Reporting

State defect, location, impact, and evidence. Separate blockers from suggestions. Prefer fixing on the introducing PR layer in a stack.
