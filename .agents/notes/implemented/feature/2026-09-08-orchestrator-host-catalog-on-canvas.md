# Agent Note: Host catalog on the orchestrator Preset canvas

Status: implemented

English | [中文](2026-09-08-orchestrator-host-catalog-on-canvas.zh.md)

## Problem

The Orchestrate tab showed only the selected Preset’s composition rows. Operators comparing “what this Preset mounts” with “what the Host process already loaded” had to leave the canvas or open a separate inventory page, and Host-only plugins never appeared in the wiki/011 layer bands.

## Decision

Client builds each Preset’s `OrchestrationDocument` with `fromInventory(preset, entries)` from `pluginInventory/list`: `composition` stays the Preset rows; `catalog` holds Loader `entries` that do not match any composition unit (prefer `entryId`, else `moduleName`). Overlaps stay a single composition node.

`toGraphDocument` lays out `composition ∪ catalog` in the same architectural layer bands (composition first within a layer). Catalog nodes use a muted palette and `membership: 'catalog'` / meta `host`. Live tool highlight continues to map only over `composition`. Host `agentOrchestrator.document()` still returns preset-only documents (`catalog: []`) until a later Host cut needs Loader entries.

Spec: [`docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.md).

## Alternatives considered

- **Single `composition` array with a `membership` flag** — rejected for this cut; the framework document already reserves `catalog[]` for units available but not selected, which matches Host-only Loader rows and keeps F1 drag-from-catalog aligned with that field.
- **Client-only overlay without filling `catalog`** — rejected; Host/Client documents and tests would diverge, and selection/detail would lack a shared unit model.
- **Union of every Preset’s rows or the full wiki/011 package list** — rejected; “already loaded” means Loader `entries` ∪ this Preset’s rows.

## Consequences

- `plugins/agent-orchestrator/src/from-inventory.ts` owns dedupe; Client `OrchestratorView` passes `snapshot.entries` into `fromInventory`.
- README describes solid = Preset · muted = Host-only on the same canvas.
- Live highlight and detail “live” rows ignore catalog membership.

## Testing

- `pnpm --filter dsh-agent-orchestrator test` (from-inventory dedupe, to-graph catalog paint / catalog-only canvas, live composition-only contract).
- `pnpm --filter dsh-agent-orchestrator typecheck` and `bundle`.
