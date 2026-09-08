# Agent Note: Host catalog visibility toggle on Orchestrate

Status: implemented

English | [中文](2026-09-08-orchestrator-host-catalog-visibility-toggle.zh.md)

## Problem

After Host catalog landed on the Preset canvas, every Orchestrate open showed composition plus muted Host-only nodes. Operators who only needed the current Preset had no way to hide the Host layer without leaving the tab.

## Decision

Toolbar checkbox **Show Host-loaded** defaults **off**. `fromInventory` still fills `catalog[]`; `documentForCanvas(doc, includeHostCatalog)` omits catalog for projection when off. State is React `useState` for this tab mount only (no settings persistence). Hiding clears a catalog selection. Spec: [`docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.md).

## Alternatives considered

- **Default on (previous full view)** — rejected; product chose Preset-first.
- **Persist in settings / localStorage** — deferred; tab-local state is enough for this cut.
- **`includeHostCatalog` on `toGraphDocument`** — rejected; a pure document filter keeps the projector unchanged and is easier to test.

## Consequences

- README documents default Preset-only and the checkbox.
- Live paint remains composition-only regardless of the toggle.

## Testing

- `pnpm --filter dsh-agent-orchestrator exec vitest run` (`document-for-canvas` + existing suite).
- `pnpm --filter dsh-agent-orchestrator bundle`.
