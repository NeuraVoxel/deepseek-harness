# `@neuravoxel/aitopo`

Canvas topology engine for AI graphs (fleet, flow, teams, custom kinds).

Humans and models share a versioned **Document / Patch / Events** protocol. Internally a lean Scene + View layer drives a pluggable **Renderer** (Canvas 2D first) with dirty-rect paint.

## Design

- Dual-face architecture and phase plan: [docs/2026-09-07-aitopo-design.md](docs/2026-09-07-aitopo-design.md)
- Implementation checklist: [docs/2026-09-07-aitopo-implementation-plan.md](docs/2026-09-07-aitopo-implementation-plan.md)
- Editor milestone (orchestrator): [docs/2026-09-08-aitopo-editor-requirements.md](docs/2026-09-08-aitopo-editor-requirements.md)
- Editor implementation plan: [docs/2026-09-09-aitopo-editor-implementation-plan.md](docs/2026-09-09-aitopo-editor-implementation-plan.md)
- twaver.vector gap backlog: [docs/2026-09-09-aitopo-twaver-vector-gap.md](docs/2026-09-09-aitopo-twaver-vector-gap.md)

Design ideas come from `twaver.vector` in `vendor/SDK2D`. This package is a **clean-room** TypeScript rewrite: no SDK2D imports, no twaver public API names, and no Cordis sync procedure.

## Status

First-party library under `vendor/` (not an upstream pin). Engine + vanilla demo ship Editor interactions (move, drop, marquee, optional undo) beside observation demos. `plugins/agent-observe` remains observation-only until a later integration.

## Commands

```sh
pnpm install
pnpm --filter @neuravoxel/aitopo test
pnpm --filter @neuravoxel/aitopo demo
```

## Public API (summary)

```ts
import {
  Network,
  parseDocument,
  applyPatch,
  PatchHistory,
  MoveNodeInteraction,
  ExternalDropInteraction,
  MarqueeSelectInteraction,
} from '@neuravoxel/aitopo'

const network = new Network({
  // Extra interactions are appended to defaults (PanZoom + SelectActivate).
  interactions: [
    new ExternalDropInteraction(),
    new MoveNodeInteraction(),
    new MarqueeSelectInteraction(),
  ],
})
network.mount(el)
network.load(parseDocument(json))
network.apply(patch)
network.on(event => { /* GraphEvent */ })
network.destroy()
```

Pass `defaultInteractions: false` to attach only the listed modules (tests / custom packing).

## Editor interactions

| Class | Role |
|---|---|
| `MoveNodeInteraction` | Drag unlocked selected nodes; commit `updateNode` (+ membership); emit `nodeMoved` / `groupMembershipChanged`. Option `hideOthersWhileDragging` (default **false**) paints only movers + incident edges while dragging |
| `CreateEdgeInteraction` | **Alt+drag** node→node (or `requireAlt: false` exclusive link mode); rubber-band; `commitEdgeCreate` → `edgeCreated` |
| `DeleteEdgeInteraction` | Delete/Backspace removes selected edges → `edgeRemoved` |
| `ExternalDropInteraction` | HTML5 drop → opaque `externalDrop` (engine does **not** `addNode`) |
| `MarqueeSelectInteraction` | **Shift+empty-space** drag; intersect select; unmodified empty drag stays pan |

### Events

- `nodeMoved` — `{ nodeId, from, to }` after pointer-up commit
- `groupMembershipChanged` — `{ nodeId, fromGroupId, toGroupId }` when membership changes
- `externalDrop` — `{ x, y, data, groupId? }` scene coords + opaque string
- `edgeCreated` — `{ edgeId, from, to, kind? }` after Alt-link (or link mode) commit
- `edgeRemoved` — `{ edgeId }` after Delete/Backspace or `commitEdgeRemove`

### Protocol fields

- `GraphNode.locked?: boolean` — move and membership edits skip locked nodes (selection still allowed)
- `GraphGroup.style?: { stroke?, strokeWidth?, strokeDash?, fill? }` — Canvas2D band outline (e.g. dashed green composition vs solid gray catalog)

### Drop MIME types

`ExternalDropInteraction` reads `text/plain` first, then `application/aitopo-drop` when plain is empty. Hosts should set both when possible.

### Undo / redo

Optional `PatchHistory` records forward/inverse `GraphPatch` pairs around `apply` / `toJSON`. Hosts may ignore it and own their own stack. The vanilla demo wires Undo/Redo only in **Editor** mode.

### Demo

- **Fleet / Flow / Teams** — observation mode (defaults only); unchanged behavior.
- **Editor** — remounts with editor interactions, loads `fixtures/editor.json` (sample **data/control** edges), Alt+drag to link, Delete edge / Delete key, **Link mode**, **Kind** toggle, **Hide others** (default off — full scene paint), drop catalog chip, Undo/Redo via `PatchHistory`.

## Non-goals (current)

- React bindings (plugin adapter later)
- WebGL renderer (interface reserved)
- Overview / HTML node UI
- Copying or wrapping `vendor/SDK2D`
- Resize / rotate handles

Editor requirements and decisions: [Editor requirements](docs/2026-09-08-aitopo-editor-requirements.md), [Editor plan](docs/2026-09-09-aitopo-editor-implementation-plan.md). Implementation borrows **ideas** from `vendor/SDK2D/twaver/vector/` under the same clean-room rules as the observation engine.

## Known Limitations and Deferred Work

- SubNetwork drill-down is single-level (root ↔ one child).
- Alarm badges cover display only; no propagation tree; `alarmChanged` is not emitted yet.
- Pan/zoom triggers full-frame invalidate; element edits use dirty-rect.
- Marquee is replace-only on pointer-up (no Shift-append).

Full per-module status vs `twaver.vector`: [docs/2026-09-09-aitopo-twaver-vector-gap.md](docs/2026-09-09-aitopo-twaver-vector-gap.md).
