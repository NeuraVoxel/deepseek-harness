# Agent Note: Plugin-local kit Agent Notes (agent-observe pilot)

Status: proposed

English | [中文](2026-09-11-plugin-local-kit-agent-notes.zh.md)

## Problem

Opt-in packages under `plugins/` are not product packages under `packages/`, yet non-trivial plugin work still lands Agent Notes in the root `.agents/notes/` tree and inherits harness bilingual / `doc-sync` expectations. Runtime mounting is already detached (`--patch` / `dsh plugin`), but process ownership is not: plugin UX decisions pollute the product note inventory, and contributors cannot take a plugin's decision history with the package if it later leaves the monorepo. [K1 peer repos](../../implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md) keep harness product gates independent of `@neuravoxel/ai-eng`; that must stay true while plugins still need a portable note gate.

## Proposal

Keep plugins as pnpm workspace members for co-development. Give each opted-in plugin its own kit-shaped `.agents/` tree. Pilot on `plugins/agent-observe` only.

### Authority

| Change scope | Note home | Gate |
|---|---|---|
| `packages/`, `apps/`, harness process or product contracts | Root `.agents/notes/` (bilingual + `doc-sync`) | Existing harness gates |
| Behavior owned only by `plugins/agent-observe/**` | `plugins/agent-observe/.agents/notes/` (kit: English single file) | `pnpm --filter dsh-agent-observe run verify-notes` |
| Harness API change plus plugin adapter | One note per owning tree (root for the contract, plugin for the adapter); do not describe plugin-only UI only in the root tree | Each tree's gate |

PRs that touch only the plugin tree and do not change `packages/` contracts do **not** require a root Agent Note. Non-trivial plugin decisions require a note under the plugin tree.

### Scaffold (observe)

Under `plugins/agent-observe/`:

- Run `pnpm exec ai-eng init .` (or `--upgrade`) at the **plugin** root — never at the monorepo root.
- Kit-owned `AGENTS.md` plus a short pointer to [`plugins/AGENTS.md`](../../../../plugins/AGENTS.md) for harness plugin standing orders (no edit of `packages/` / `vendor/`).
- `.agents/notes/` lifecycle folders; optional portable skills from init.
- `docs/testing-policy.md` from init is advisory for note/process only; it does **not** replace harness `docs/testing.md` or impose kit ~90% coverage on the plugin.
- Add `@neuravoxel/ai-eng` as an observe **devDependency** and script `"verify-notes": "ai-eng verify-notes .agents/notes"`.
- Record this process decision also as one implemented note inside the plugin tree once the scaffold lands (proves the verify path).

### Root / plugins documentation

Update root `AGENTS.md` (one pointer) and `plugins/AGENTS.md` / `plugins/README.md` so the exemption and note-home rule are discoverable. Do not teach root `doc-sync` to scan `plugins/*/`.

### Migration

Existing root notes that mention agent-observe (for example Turn-scoped flow) stay in the root tree for this pilot. Optional later moves of plugin-only history use cross-links; no bulk rewrite in the pilot PR.

## Alternatives considered

- **Convention only, no `verify-notes`:** rejected — format drifts without a mechanical gate; conflicts with choosing kit-level rigor.
- **Shared `plugins/.agents/` for all plugins:** rejected — harder to extract one package later; pilot wants per-package takeaway.
- **Carve plugins out of root note gates only:** rejected — stops root pollution but leaves plugin decisions without an owning verified tree.
- **Split plugins into separate git repos now:** rejected — loses monorepo DX; workspace + local kit notes is the intermediate shape.
- **Harness root depends on kit for product gates (K2):** rejected — conflicts with [K1](../../implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md); kit stays a plugin-local tool.

## Acceptance criteria

- `plugins/agent-observe` has kit `.agents/notes/`, plugin `AGENTS.md` with pointer to `plugins/AGENTS.md`, and a green `verify-notes` script.
- Root / `plugins` docs state the note-home table and the root-note exemption for plugin-only PRs.
- Root `package.json` still does not declare `@neuravoxel/ai-eng` for harness product gates.
- Root `doc-sync` / note format gates still scan only root `.agents/notes/`.
- No scaffold under orchestrator, turn-cost, or hello-* in the pilot.
- One plugin-local note records the observe kit-notes decision after scaffold.

## Risks

- Contributors may still write plugin UX notes under the root tree out of habit until docs and review catch it.
- Kit `testing-policy.md` next to the plugin may be misread as a coverage mandate; the plugin `AGENTS.md` must state it is advisory.
- Pinning `@neuravoxel/ai-eng` on observe needs the same private-read install path already used for aitopo's kit pin.
- Historical root notes about observe stay split from the new tree until an optional migration.
