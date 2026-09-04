# Data Loop Platform — engineering template (MVP)

Self-contained scaffold for an autonomous-driving **data closed-loop** platform.
Copy this directory out as a new git repository; it is **not** part of the deepseek-harness pnpm workspace.

Design source (in the parent learning wiki): [../notes/003-ad-data-loop-eng-template.md](../notes/003-ad-data-loop-eng-template.md).

## What this MVP includes

- `AGENTS.md` — standing orders for humans and coding agents
- `.agents/notes/` — proposed / implemented / rejected decision records
- `.agents/skills/` — `pre-push-checks`, `code-review`, `data-contract-review`
- `schemas/` — versioned JSON Schema examples + verifier
- `pipelines/parse` — tiny Python parse step + closed-loop fixture test
- `lefthook.yml` — cheap local hooks (no full suite)
- `.github/workflows/ci.yml` — schema + Python test lanes

Placeholders only: `apps/api`, `apps/web`, `packages/`, integration docs.

## Quick start

```sh
cd adlc/data-loop-template   # or your copied repo root
make install                 # pip --user jsonschema + pytest
make check
```

If `pip install -e ".[dev]"` is available in your environment, that works too; the Makefile defaults to a no-venv install for portability.

Optional hooks (requires [lefthook](https://github.com/evilmartians/lefthook)):

```sh
lefthook install
```

## Copy out as a new repo

```sh
cp -a adlc/data-loop-template /path/to/data-loop-platform
cd /path/to/data-loop-platform
git init
# edit AGENTS.md product name; remove the parent-wiki relative links if desired
```
