# agent-orchestrator: Host catalog on the same Preset canvas

English | [中文](2026-09-08-orchestrator-host-catalog-on-canvas-design.zh.md)

**Status:** approved design (2026-09-08)

**Scope:** `plugins/agent-orchestrator` only. Reuses `pluginInventory/list` (`entries` + `agentPresets`). No new Remote, no AITopo editor changes, no wiki/011 repository-wide package listing.

**Related:** [agent-orchestrator design](../../../plugins/agent-orchestrator/docs/2026-09-08-agent-orchestrator-design.md) (`catalog[]` already reserved); [wiki/011](../../../wiki/011-插件分组与主要作用.md) (layer banding only).

## Product

Each Preset page shows the union of:

1. **This Preset’s composition rows** (Agent plane).
2. **Host Loader plugins** currently loaded that are **not** already represented in that composition.

Both sets appear on one canvas, still banded by wiki/011 architectural layers. Style distinguishes membership: solid = in this Preset; muted/dashed = Host-only.

A plugin present in both Loader and this Preset is **one** node, owned by composition (Preset wins).

## Inventory (source)

`pluginInventory/list` is a point-in-time Host snapshot:

| Field | Meaning |
|---|---|
| `entries` | Non-group Cordis Loader plugins (Host plane) |
| `agentPresets[].rows` | Flattened composition rows per preset (Agent plane) |

“All loaded” for this feature means **A**: `entries ∪ this preset’s rows`, not every package in the monorepo and not the union of all presets.

## Document construction

Build `OrchestrationDocument` from the selected preset group plus `entries`:

| Field | Contents |
|---|---|
| `composition` | Selected preset’s rows (unchanged mapping via `fromPresetComposition` / shared unit helpers) |
| `catalog` | Loader `entries` that do **not** match any composition unit |

**Dedupe key:** prefer `entryId` when both sides have a non-empty id; otherwise `moduleName`. Matching Loader rows are dropped from `catalog` only.

Catalog units carry the same wiki/011 `layer` / `packageGroup` resolution from `moduleName`, plus Loader `enabled` / `fiberPhase`. Treat catalog units as non-editable for F1 (`locked: true` or equivalent membership flag on graph `data`).

**Data path (this cut):** Client keeps calling `remote.pluginInventory.list()`, then `fromInventory(preset, entries)` (new helper beside `from-preset`). Host `agentOrchestrator.document()` may stay preset-only until a later cut; no new Typert method required for F0 display.

## Canvas projection

`toGraphDocument` lays out **`composition ∪ catalog`** with `layoutByArchitecturalLayer`:

- Within each layer: composition units first (inventory order), then catalog units (Loader order).
- Empty layers omitted.
- Empty states: both empty → existing empty note; composition empty but catalog non-empty → draw Host-only bands (do not treat as empty/broken).

**Paint**

| Membership | Appearance |
|---|---|
| `composition` | Existing enablement / live palette |
| `catalog` | Lower-contrast fill, weaker or dashed stroke, quieter label; meta caption `host` / zh「仅宿主」 |

Detail panel states Host-only when the inspected unit is from `catalog`. Toolbar hint: solid = this Preset · muted = Host loaded.

## Live highlight

Unchanged gate: live paint only when the viewed preset is the Session’s `agentPreset` (or preset unknown) and the Session is running. Tool→unit mapping and highlight apply **only to `composition`**. Catalog nodes never receive tool live highlight.

## Non-goals

- Editing / drag from catalog into composition (F1 + AITopo Editor).
- Showing unloaded monorepo packages from wiki/011.
- Union across all presets.
- Changing `dsh-host-plugin-inventory` contracts.

## Tests

Plugin vitest:

- Dedupe by `entryId` and by `moduleName`; overlap stays in `composition` only.
- `to-graph` includes catalog paint and mixed-layer layout; catalog-only non-empty canvas.
- Live activity ignores catalog unit ids.

## Docs

- Update `plugins/agent-orchestrator` README pair: Preset canvas shows Host-loaded extras muted beside composition.
- Same-PR Agent Note: why `catalog[]` on-canvas (reuse reserved field) beat a `membership` flag on a single composition array.
