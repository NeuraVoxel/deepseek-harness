# agent-orchestrator: Toolbar toggle for Host catalog visibility

English | [中文](2026-09-08-orchestrator-host-catalog-visibility-toggle-design.zh.md)

**Status:** approved design (2026-09-08)

**Scope:** `plugins/agent-orchestrator` Client Orchestrate tab only. No Host Remote changes, no persistence, no change to `fromInventory` / inventory contracts.

**Related:** [Host catalog on canvas](2026-09-08-orchestrator-host-catalog-on-canvas-design.md) (document still carries full `catalog[]`).

## Product

Operators often want the current Preset’s composition alone. Host-only (muted) nodes are optional context.

Toolbar checkbox **Show Host-loaded** / **显示宿主已加载**:

| State | Canvas |
|---|---|
| Off (default) | `composition` only |
| On | `composition ∪ catalog` (current full view) |

State is React `useState` for this Orchestrate tab mount only. Changing the Preset select does **not** reset the checkbox. Refreshing or leaving and reopening the tab resets to **off**.

## Projection

`fromInventory` always fills `catalog` as today. Before `toGraphDocument`, when the checkbox is off, pass a document copy with `catalog: []`. Do not mutate the inventory-derived document in place if it is reused for detail lookup of catalog units while hidden (detail must not open Host-only nodes that are off-canvas).

When turning the checkbox **off**, if the inspected unit’s membership is `catalog`, clear selection (and AITopo selection).

Live highlight remains composition-only and unchanged.

## Copy

- Checkbox label: locale keys (zh/en).
- Hint when Host catalog is hidden: drop the “muted = Host” membership clause (or use a Preset-only membership hint).
- Hint when shown: keep existing solid / muted membership hint.

## Non-goals

- Persisting the preference (settings / localStorage).
- Changing Host `agentOrchestrator.document()`.
- Lighting catalog nodes.
- Segmented control / second canvas mode beyond show/hide catalog.

## Tests

- Unit or thin view-model helper: projecting with `includeHostCatalog: false` yields graph nodes only from composition ids.
- Turning hide on after selecting a catalog unit clears selection (test the clear predicate if extracted; otherwise cover via helper).
- Existing catalog layout / live composition-only tests stay green.
