# AGENTS.md — Opt-in plugins

Standing orders for work under `plugins/`. Orientation and the package map live in [README.md](README.md).

**Do not modify harness product source** to make a plugin compile or run. Stay inside this tree and its declared dependencies. Off-limits: `packages/`, `apps/`, `native/`, `python/`, `scripts/` (gates / generators), shipped profile trees, and other product-owned paths outside `plugins/`.

**Do not modify `vendor/` source**, including `vendor/aitopo`. Cordis pins and first-party vendor trees follow [vendor/AGENTS.md](../vendor/AGENTS.md) and [vendor/README.md](../vendor/README.md); plugins must not patch, fork, or casually edit those trees.

**Agent Notes:** opted-in plugins may own kit-shaped `.agents/notes/` (English + `ai-eng` / package `verify-notes`). Pilot: [`agent-observe`](agent-observe/AGENTS.md). Plugin-only PRs that do not change `packages/` contracts write notes there and do **not** require a root harness Agent Note. Harness contracts still use root `.agents/notes/` ([process note](../.agents/notes/implemented/process/2026-09-11-plugin-local-kit-agent-notes.md)).

When a harness API changes, **adapt the plugin** (types, fixtures, adapters, copy) to the current public exports. Do not patch the harness, fork package sources into the plugin, or weaken harness gates for a plugin.

Mount only through `cordis.patch.yml` / `--patch`, or `dsh plugin --profile <name> add ./plugins/<pkg>` when the package declares `dsh.bundle`. Import published package exports; do not use another package’s `src/` as an import path.

**AITopo changes:** design engine needs as a **requirements proposal** for the peer repository `NeuraVoxel/aitopo` (requirements table, non-goals, acceptance — same style as that repo’s `docs/*-requirements.md`). Do not implement engine changes under `vendor/aitopo` from a harness plugin change. Session UI adapters and host chrome stay in the plugin; after the peer ships, upgrade by bumping the submodule pointer per [vendor/README.md](../vendor/README.md#upgrading-aitopo-submodule).
