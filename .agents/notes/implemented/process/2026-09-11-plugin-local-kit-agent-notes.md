# Agent Note: Plugin-local kit Agent Notes (agent-observe pilot)

Status: implemented

English | [中文](2026-09-11-plugin-local-kit-agent-notes.zh.md)

## Problem

Opt-in packages under `plugins/` are not product packages under `packages/`, yet non-trivial plugin work still lands Agent Notes in the root `.agents/notes/` tree and inherits harness bilingual / `doc-sync` expectations. Runtime mounting is already detached (`--patch` / `dsh plugin`), but process ownership is not: plugin UX decisions pollute the product note inventory, and contributors cannot take a plugin's decision history with the package if it later leaves the monorepo. [K1 peer repos](../architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md) keep harness product gates independent of `@neuravoxel/ai-eng`; that must stay true while plugins still need a portable note gate.

## Decision

Plugins remain pnpm workspace members for co-development. Each opted-in plugin may own a kit-shaped `.agents/` tree. The pilot is `plugins/agent-observe` only.

### Authority

| Change scope | Note home | Gate |
|---|---|---|
| `packages/`, `apps/`, harness process or product contracts | Root `.agents/notes/` (bilingual + `doc-sync`) | Existing harness gates |
| Behavior owned only by `plugins/agent-observe/**` | `plugins/agent-observe/.agents/notes/` (kit: English single file) | `pnpm --filter dsh-agent-observe run verify-notes` |
| Harness API change plus plugin adapter | One note per owning tree (root for the contract, plugin for the adapter); do not describe plugin-only UI only in the root tree | Each tree's gate |

PRs that touch only the plugin tree and do not change `packages/` contracts do **not** require a root Agent Note. Non-trivial plugin decisions require a note under the plugin tree.

### Scaffold (observe)

`plugins/agent-observe` carries kit `AGENTS.md` (with markers), `.agents/notes/`, portable skills, and advisory `docs/testing-policy.md`. After the kit region, the file points at [`plugins/AGENTS.md`](../../../../plugins/AGENTS.md). `@neuravoxel/ai-eng` is an observe **devDependency**. `pnpm run verify-notes` runs `scripts/verify-notes.mjs`, which calls the kit public `verifyAgentNoteFormat` API (the `ai-eng` bin's direct-run check fails under pnpm symlinks). The in-plugin record is [Observe package uses kit Agent Notes](../../../../plugins/agent-observe/.agents/notes/implemented/process/2026-09-11-observe-kit-agent-notes.md).

Root `doc-sync` does not scan `plugins/*/`. Root `package.json` does not declare `@neuravoxel/ai-eng` for product gates.

### Migration

Existing root notes that mention agent-observe stay in the root tree for this pilot. Optional later moves of plugin-only history use cross-links.

## Alternatives considered

- **Convention only, no `verify-notes`:** rejected — format drifts without a mechanical gate; conflicts with choosing kit-level rigor.
- **Shared `plugins/.agents/` for all plugins:** rejected — harder to extract one package later; pilot wants per-package takeaway.
- **Carve plugins out of root note gates only:** rejected — stops root pollution but leaves plugin decisions without an owning verified tree.
- **Split plugins into separate git repos now:** rejected — loses monorepo DX; workspace + local kit notes is the intermediate shape.
- **Harness root depends on kit for product gates (K2):** rejected — conflicts with [K1](../architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md); kit stays a plugin-local tool.

## Consequences

- Observe-only decisions land under the plugin kit tree; harness bilingual notes stay for product contracts.
- Contributors may still write plugin UX notes under the root tree out of habit until docs and review catch it.
- Kit `testing-policy.md` beside the plugin is advisory; package tests stay owner-local.
- Historical root notes about observe remain split from the new tree until an optional migration.
- Plan: [docs/superpowers/plans/2026-09-11-plugin-local-kit-agent-notes.md](../../../../docs/superpowers/plans/2026-09-11-plugin-local-kit-agent-notes.md).

## Testing

- `pnpm --filter dsh-agent-observe run verify-notes`
- `pnpm --filter dsh-agent-observe test`
- `pnpm --filter dsh-agent-observe exec tsc -b --pretty false`
