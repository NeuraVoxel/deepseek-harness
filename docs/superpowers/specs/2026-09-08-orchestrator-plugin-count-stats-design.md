# agent-orchestrator: Toolbar Preset vs Host-loaded plugin counts

English | [中文](2026-09-08-orchestrator-plugin-count-stats-design.zh.md)

**Status:** approved design (2026-09-08)

**Scope:** `plugins/agent-orchestrator` Client Orchestrate tab toolbar only. No Host Remote changes, no persistence, no change to `fromInventory` / canvas projection.

**Related:** [Host catalog visibility toggle](2026-09-08-orchestrator-host-catalog-visibility-toggle-design.md) (checkbox still controls canvas only).

## Product

Operators need a quick count of plugins in the selected Preset versus Host-loaded plugins that are not in that Preset.

Toolbar shows a read-only inline pair after the Preset select:

| Count | Source |
|---|---|
| This Preset | `orchestrationDoc.composition.length` |
| Host-loaded | `orchestrationDoc.catalog.length` |

Counts always come from the full inventory-derived document for the selected Preset. The **Show Host-loaded** checkbox does **not** change these numbers; it only shows or hides catalog nodes on the canvas. Changing the Preset select updates both counts.

## Copy

Locale-owned keys (zh/en), aligned with existing membership vocabulary:

- zh: `本 Preset {composition} · 宿主已加载 {catalog}`
- en: `This Preset {composition} · Host-loaded {catalog}`

No new product terms such as Session / Global in UI copy.

## UI

Inline in the existing `.toolbar` row as muted secondary text (similar opacity to labels / hint). No interaction, no extra toolbar row, no cards.

## Non-goals

- Counting only currently visible canvas nodes.
- Persisting or syncing counts to Host / settings.
- Changing live highlight, detail panel, or graph projection.
- Separate Session vs Global naming in the product UI.

## Tests

- Derive counts from `orchestrationDoc` (not `canvasDoc` / `documentForCanvas` output) so a test with `includeHostCatalog: false` still reports the full catalog length when reading the inventory document.
- Existing Host-catalog visibility and live-highlight tests stay green.
