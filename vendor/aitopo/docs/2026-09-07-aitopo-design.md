# AITopo design

**Package:** `@neuravoxel/aitopo`
**Location:** `vendor/aitopo/`
**Status:** approved design (2026-09-07)
**Audience:** engine authors; `plugins/agent-canvas` integrators (phase 2)
**Implementation plan:** [2026-09-07-aitopo-implementation-plan.md](./2026-09-07-aitopo-implementation-plan.md)

## Summary

AITopo is a Canvas topology engine for AI graphs (fleet, flow, teams, and later custom kinds). Humans and models share a versioned **Document / Patch / Events** protocol. Internally, a lean Scene + View layer (invalidate / validate / dirty-rect paint) drives a pluggable **Renderer** (Canvas 2D first; WebGL later). Design ideas come from `twaver.vector` in `vendor/SDK2D`; implementation is a clean-room TypeScript rewrite with no twaver source, runtime dependency, or public API names.

Phase 1 ships the engine and a vanilla DOM demo. Phase 2 adapts `plugins/agent-canvas` behind a feature flag and retires the SVG path once behavior matches.

## Goals

1. General AI graph library: topology, tool/step flow, teams, extensible node kinds.
2. Model-drivable surface: full document, incremental patch, structured event readback.
3. Borrow twaver.vector ideas only: dual canvas, dirty validate loop, view cache, interaction plugins, zoom/viewport — new names and APIs.
4. Prove the engine with unit tests + demo before changing `plugins/agent-canvas`.

## Non-goals (phase 1)

- React bindings (vanilla demo only; React host lives in the plugin in phase 2).
- Model-visible DSH tools (`aitopo_*`) unless a later product request adds them.
- Importing or wrapping `vendor/SDK2D` code.
- Undo stack, PropertyBox, GIS, DXF, HTML node/link UI, Overview widget.
- Making the graph the Agent orchestration source of truth.

## Decisions

| Topic | Choice |
|---|---|
| Architecture | Dual-face: Protocol (AI/plugin) + internal Scene/View/Renderer |
| Package home | `vendor/aitopo` (first-party; not an upstream Cordis pin) |
| npm name | `@neuravoxel/aitopo` |
| twaver relationship | Clean-room; `vendor/SDK2D` is design reference only |
| Render | Canvas 2D implementation + `Renderer` interface for future WebGL |
| Paint strategy | Dirty-rect from day one (full-frame on camera/resize) |
| Alarm | In scope — workflow errors / node alerts |
| SubNetwork | In scope — Agent Teams drill-down (single level in phase 1) |
| React | Deferred to plugin adapter |
| Delivery | Engine + demo first; agent-canvas integration second |

## Architecture

```
GraphDocument / GraphPatch / GraphEvent     ← AI & plugin contract
        │  load / apply / toJSON / on
        ▼
Network (mount, camera, rAF, interactions)
        │
        ├── GraphScene (indexes, alarms, subnetwork stack)
        ├── Views (NodeView / EdgeView / GroupView — markDirty → validate → paint)
        └── Renderer (Canvas2D now; WebGL later)
              ├── root canvas   (scene content, dirty-rect clipped)
              └── overlay canvas (selection / hover / transient chrome)
```

### Mapping from twaver.vector (ideas only)

| twaver.vector idea | AITopo name |
|---|---|
| ElementBox + Element | GraphScene + scene nodes/edges/groups |
| Network dual canvas | root + overlay canvases |
| invalidate → RAF validate | dirty ids + dirty rects + `requestAnimationFrame` |
| ElementUI | NodeView / EdgeView / GroupView |
| Interaction classes | `Interaction.attach(network) → disposer` |
| ZoomManager | Viewport (physical zoom in phase 1) |
| Alarm | Alarm model + AlarmBadge view |
| SubNetwork | SubNetwork enter/exit + nested document refs |

Do not reuse twaver identifiers (`DataBox`, `ElementBox`, `ElementUI`, `s()` / `c()`, etc.) as public AITopo names.

## Package layout

```
vendor/aitopo/
  package.json                 # name: @neuravoxel/aitopo, private, type: module
  README.md
  docs/
    2026-09-07-aitopo-design.md
  src/
    protocol/                  # Document, Patch, Events + zod schemas
    model/                     # GraphScene, Alarm, SubNetwork
    ui/                        # Views: dirty / validate / hit-test / bounds
    render/                    # Renderer interface + Canvas2DRenderer
    network/                   # Network, Viewport, dirty-rect loop, mount
    interaction/               # PanZoom, SelectActivate
    layout/                    # grid, flow columns
    index.ts                   # public: protocol types + Network API
  demo/                        # vanilla DOM (no React)
  test/
```

**Boundaries**

- No dependency on Cordis, React, or `@deepseek-ai/dsh-*`.
- No import from `vendor/SDK2D`.
- Public exports: protocol types, Network API, built-in layouts/interactions, Canvas2D renderer factory.
- `model` / `ui` stay package-private (or `@internal`) unless a later API review opens them.
- README must state: first-party engine under `vendor/`; do not run Cordis/SDK2D sync procedures against it.

## Protocol

### GraphDocument

```ts
interface GraphDocument {
  version: 1
  meta?: {
    title?: string
    kind?: 'topology' | 'flow' | 'custom'
    [key: string]: unknown
  }
  nodes: GraphNode[]
  edges: GraphEdge[]
  groups?: GraphGroup[]
  /** Nested graphs for SubNetwork drill-down */
  networks?: Record<string, GraphDocument>
  viewport?: { x: number; y: number; zoom: number }
}
```

**GraphNode** (minimum): `id`, `type` (e.g. `agent` | `step` | `tool` | `team`), `label`, optional `status`, `x`/`y`/`w`/`h`, `parentId`, `groupId`, `networkId` (child subnetwork), `alarms`, `data` (opaque).

**GraphEdge:** `id`, `from`, `to`, optional `kind`, `alarms`, `data`.

**GraphGroup:** `id`, `label`, `memberIds`, optional band geometry + style.

Missing coordinates are filled by `network.layout(...)`; `layoutCompleted` may carry computed positions for the host to persist.

### GraphPatch

Structural op list (not RFC 6902). Ops include: `addNode` / `updateNode` / `removeNode`, same for edge/group, `setAlarms`, `setViewport`, `setSelection`, `enterSubNetwork` / `exitSubNetwork` (or these last two as Network methods that still emit events).

`apply(patch)` is atomic: validation failure rejects the whole patch with a structured error; Scene is unchanged.

### GraphEvent

Engine → host:

- `selectionChanged`, `hoverChanged`
- `nodeActivated` (click / dblclick detail)
- `viewportChanged`
- `layoutCompleted` (ids + coordinates)
- `alarmChanged`
- `subNetworkChanged` (stack after enter/exit)
- `documentChanged` (optional summary when local interaction mutates durable fields)

### Network public API

```ts
load(doc: GraphDocument): void
toJSON(): GraphDocument
apply(patch: GraphPatch): void
layout(name: string, options?: unknown): void
enterSubNetwork(id: string): void
exitSubNetwork(): void
on(handler: (e: GraphEvent) => void): () => void
mount(el: HTMLElement): void
destroy(): void
```

Validate Document/Patch with zod (or equivalent) at the protocol boundary. Invalid input fails loud and never enters Scene.

## Internal engine

### GraphScene

- Mutable tables + indexes: byId, byGroup, adjacency, alarm index, subnetwork stack (`root` → current).
- Mutations only through `load` / `apply` / controlled layout / enter-exit.
- Each mutation bumps `sceneVersion` and records dirty element ids.

### Views

- `NodeView` / `EdgeView` / `GroupView` / `AlarmBadge`: cache body bounds, paths, text metrics.
- `markDirty()` → main loop `validate()` → `paint(renderer)`.
- Hit-test: geometry first (rect / rounded rect / polyline tolerance). Offscreen pixel hit-test is optional later.

### Renderer

```ts
interface Renderer {
  beginFrame(viewport: ViewportState, dirty: readonly Rect[]): void
  drawGroup(group, view): void
  drawEdge(edge, view): void
  drawNode(node, view): void
  endFrame(): void
}
```

Phase 1: `Canvas2DRenderer`. Network must not call Canvas 2D APIs directly outside the renderer.

### Dirty-rect loop

```
mutation → markDirty(ids) → union dirtyRects
rAF → validate(dirty views) → clip(dirtyRects) → paint root → paint overlay as needed
```

- Element edits: dirty-rect path.
- Pan / zoom / resize: full-frame invalidate (camera change invalidates screen mapping).
- Overlay may clear/repaint fully when only selection chrome changes.
- Debug: `debugPaintRects` draws dirty unions; on paint error, one-frame full invalidate fallback.

### Alarm

- `Alarm`: `id`, `level` (`info` | `warn` | `error`), `message`, optional `ts`.
- Attached to nodes and/or edges via document fields or `setAlarms` patch.
- Phase 1: data model + badge / outer emphasis for `error`; no alarm propagation tree.

### SubNetwork

- Child graphs live in `document.networks[id]` (or equivalent ref).
- Phase 1: single-level drill-down (root ↔ one child). Multi-level stack structure is reserved.
- Double-click / `enterSubNetwork` / `exitSubNetwork` + `subNetworkChanged` event.
- Agent Teams mapping (phase 2+): each team → one SubNetwork; fleet overview is root.

### Interaction

```ts
interface Interaction {
  attach(network: Network): () => void
}
```

Phase 1: `PanZoomInteraction`, `SelectActivateInteraction` (click / dblclick → `nodeActivated`).

### Layout

- `layoutGrid`, `layoutFlowColumns` (cover agent-canvas fleet and flow).
- Writes scene coordinates, marks dirty, emits `layoutCompleted`.

## Phase 2 — agent-canvas integration

Plugin remains a patch mount; Host topology types stay in the plugin.

### Dependency

```
plugins/agent-canvas → @neuravoxel/aitopo  (workspace / file: ../../vendor/aitopo)
```

Bundle AITopo into the client entry (or a dedicated chunk) via existing tsdown config.

### Plugin-owned adapter (not inside AITopo)

| Existing | After |
|---|---|
| `derive-topology` / `derive-flow` | Keep |
| `layout.ts` / `layout-flow.ts` | Call `network.layout` or precompute x/y then `load` |
| SVG in `CanvasView.tsx` | `AITopoHost` React shell: mount / destroy / load / apply |
| `use-canvas-viewport` | Retire once Network owns the camera |

Suggested files under `plugins/agent-canvas/src/client/aitopo/`:

- `snapshot-to-document.ts`
- `flow-to-document.ts`
- `AITopoHost.tsx`
- `alarms-from-status.ts`

### Mapping

- Fleet Session → `type: 'agent'`; parent edges; workspace/tree groups; Teams → SubNetwork when available.
- Flow step/tool → `type: 'step' | 'tool'`; `status` + Alarm for errors; active highlight via style/status.
- `nodeActivated` click → `openSession`; dblclick → `showFlow` or `enterSubNetwork`.
- AITopo must not import `SessionId`; adapter maps branded ids ↔ strings.

### Integration steps

1. Add dependency + feature flag (SVG ↔ AITopo).
2. Fleet overview first, then Flow.
3. Teams → SubNetwork when Teams remote exists.
4. Remove SVG path and viewport hook after parity.

## Phases and acceptance

| Phase | Deliverable | Done when |
|---|---|---|
| P0 | Skeleton: protocol zod, Scene, Canvas2D, dirty-rect loop, PanZoom/Select | Units + demo loads a static document |
| P1 | Patch, Events, Alarm badges, SubNetwork enter/exit, grid/flow layout | Demo shows patch stream, alarms, drill-down |
| P2 | agent-canvas Fleet via `AITopoHost` + flag | Fleet matches SVG behavior |
| P3 | Flow + Teams SubNetwork; delete SVG | Flow highlight + error Alarm + team drill-down |

### P1 success criteria

1. JSON document load + patch apply in demo.
2. Alarm and one-level SubNetwork demonstrable.
3. No React / DSH dependencies in `@neuravoxel/aitopo`.
4. This design remains the integration guide for P2.

## Testing

**Engine**

- Protocol: accept valid docs; reject invalid; atomic patch failure leaves scene unchanged.
- Scene: indexes after apply; SubNetwork stack enter/exit.
- Dirty-rect: element edit dirties related rects; zoom triggers full invalidate.
- Hit-test / Events: click, dblclick, selection payloads stable.
- Demo: manual smoke (mount, paint, dispose, replace document).

**Plugin (P2+)**

- Preserve client behavior; add recorded snapshots when product-visible interaction changes require them per repo testing policy.

## Risks

| Risk | Mitigation |
|---|---|
| Accidental twaver API cloning | Ban-list in review; no SDK2D imports |
| Dirty-rect incorrect clips | `debugPaintRects`; full-frame fallback |
| Document ↔ Scene drift | Single write path: load / apply / layout / enter-exit; durable UI writes emit Events |
| `vendor/` confusion with upstream pins | README ownership note; no Cordis sync |
| `@neuravoxel` vs `@deepseek-ai` scope | Private workspace package; publish only by separate decision |
| Orphan `vendor/aitopo/lib` without `src` | First implementation PR either regenerates from new `src/` or deletes stale `lib/` before merge |

## Open implementation choices (not design blockers)

- Exact file split under `protocol/` vs colocated zod modules.
- Demo bundler (Vite vs static HTML + esbuild).
- Whether root pnpm workspace lists aitopo immediately or only after P0 skeleton lands.
- Whether `enterSubNetwork` is Patch-only, Network-only, or both (both must stay semantically equivalent if dual).
