# AITopo design — Canvas topology engine for AI

**Package:** `@neuravoxel-ai/aitopo`

**Location:** `vendor/aitopo/`

**Status:** approved design (engine + demo first; plugin integration later)

**Date:** 2026-09-07

## Problem

`plugins/agent-canvas` renders Session/Agent fleet and turn-flow topology with hand-rolled SVG. That path works for a first tab, but it does not scale to a shared graphics library that both humans and models can drive, and it does not leave a clean path to later node editing and Agent regeneration.
`vendor/SDK2D` (twaver) contains a mature vector Network stack. AITopo must **not** copy that source or squat twaver APIs. It takes the **design ideas** of `twaver.vector` and rebuilds a smaller, AI-document-first engine.

## Goals

1. Ship a Canvas 2D topology engine optimized for AI agent graphs (fleet, flow, and future drafts).
2. Make `TopoDocument` the shared contract for humans and models (schema first; tools later).
3. Borrow twaver.vector’s dual-canvas, invalidate/validate, painter, interaction, and zoom ideas without aligning class names or porting code.
4. Prove the engine with fixtures + demo before touching `plugins/agent-canvas`.

## Non-goals (v1)

- Modifying `plugins/agent-canvas`.
- Model-visible tools (`aitopo_upsert`, etc.).
- Copying or wrapping `vendor/SDK2D` runtime code.
- Alarm, HTML node/link UI, UndoManager, Overview, Logical/Mixed zoom managers.
- Making the graph the Agent orchestration source of truth (that is v2).
- Node drag that mutates the document while `mode: 'projection'`.

## Decisions

| Topic | Choice |
|---|---|
| Audience | Humans and models |
| Model surface (v1) | Versioned JSON document + parse/diff/apply; no tools yet |
| Graph vs Agent | Dual-truth, phased: v1 projection only; schema reserves `edit` / `mode: 'draft'` for later regeneration |
| Package home | `vendor/aitopo` (first-party library under `vendor/`, not an upstream Cordis sync) |
| npm name | `@neuravoxel-ai/aitopo` |
| twaver depth | Thought-level: document ↔ store ↔ dirty paint + viewport; AI-oriented API |
| Render | Pure Canvas 2D: root scene + overlay |
| Delivery | Engine + demo first; integrate into agent-canvas after demo is stable |
| Architecture | Document-first (not Element-first) |

## Architecture

```
TopoDocument (JSON, schemaVersioned)
        │  parse / diff / applyPatch
        ▼
Store (indexes + subscribers + transient UI)
        │  dirty element ids / invalidateAll
        ▼
Network (view div + rootCanvas + overlayCanvas + RAF validate)
        │
        ├── Painter registry (group / edge / node / kind-specific)
        ├── Viewport (pan / zoom / fit / world↔screen)
        └── Interaction plugins (pan-zoom / select)
```

### Mapping from twaver.vector (ideas only)

| twaver.vector | AITopo |
|---|---|
| `ElementBox` + `Element` | `TopoDocument` + Store indexes |
| `Network` dual canvas | `root` + `overlay` canvases |
| invalidate → RAF validate | dirty set + `requestAnimationFrame` |
| `ElementUI` | `Painter` registered by `kind` |
| Interaction classes | `Interaction.attach(network) → disposer` |
| ZoomManager | `Viewport` (physical zoom only in v1) |

Do not reuse twaver identifiers (`ElementBox`, `ElementUI`, `s()`/`c()`, etc.) as public AITopo names.

## Package layout

```
vendor/aitopo/
  package.json              # name: @neuravoxel-ai/aitopo, private, type: module
  README.md
  src/
    document/               # schema, parse, diff, apply, migrate
    store/                  # document indexes + transient state
    network/                # Network, Viewport, dirty rect, mount/dispose
    painters/               # built-in group / edge / node painters
    interaction/            # PanZoomInteraction, SelectInteraction
    layout/                 # simple demo layouts (grid / layered flow)
    index.ts
  demo/                     # static page loading fixtures
  fixtures/                 # sample TopoDocuments (fleet + flow)
```

**Boundaries**

- No dependency on `plugins/agent-canvas` or dsh Session branded types.
- No import from `vendor/SDK2D`.
- `vendor/README.md` (or a short `vendor/aitopo/README.md` section linked from it) must state: SDK2D is design reference only; aitopo is first-party, not an upstream pin.

Workspace wiring (pnpm workspace member, tsconfig paths) is an implementation detail of the first engine PR; the package remains private until a deliberate publish decision.

## Document model

```ts
interface TopoStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  radius?: number
  fontSize?: number
  fontFamily?: string
}

interface TopoLayer {
  id: string
  label?: string
  visible?: boolean
}

interface TopoDocument {
  schemaVersion: 1
  id: string
  title?: string
  /** projection = live mirror; draft = editable (consumed in v2+) */
  mode: 'projection' | 'draft'
  layers: TopoLayer[]
  nodes: TopoNode[]
  edges: TopoEdge[]
  groups?: TopoGroup[]
  meta?: Record<string, unknown>
}

interface TopoNode {
  id: string
  kind: string
  label: string
  x: number
  y: number
  width?: number
  height?: number
  layerId?: string
  style?: TopoStyle
  status?: string
  /** Reserved for edit → regenerate Agent; v1 may store, must not execute */
  edit?: {
    regeneratable?: boolean
    agentHint?: Record<string, unknown>
  }
  data?: Record<string, unknown>
}

interface TopoEdge {
  id: string
  from: string
  to: string
  kind?: string
  style?: TopoStyle
  data?: Record<string, unknown>
}

interface TopoGroup {
  id: string
  label: string
  memberIds: string[]
  /** Optional world-space band when layout precomputes group bounds */
  x?: number
  y?: number
  width?: number
  height?: number
  style?: TopoStyle
}
```
`TopoPatch` is an opaque structural patch type owned by `document/`; v1 may use a simple op list (`replace` document, `upsert`/`remove` node|edge|group) rather than RFC 6902 JSON Patch. `PaintElement` / `PaintEnv` / `Point` / `Rect` are engine-internal paint types derived from the document indexes plus transient state.

### Persistence rules

- **Persisted in the document:** nodes, edges, groups, layers, `mode`, `edit`, `meta`, geometry.
- **Transient in Store only:** selection, hover, gesture in-progress coordinates, viewport unless the host explicitly snapshots it into the document.
- Parse with a schema validator at the document boundary; invalid input fails loud.
- `schemaVersion` is monotonic. New breaking document forms get a new version and a named parser successor; v1 code does not silently accept unknown major versions.

### Document API

```ts
parseDocument(input: unknown): TopoDocument
diffDocument(a: TopoDocument, b: TopoDocument): TopoPatch
applyPatch(doc: TopoDocument, patch: TopoPatch): TopoDocument
```

## Render pipeline

### DOM

```
div.aitopo-view
  ├── canvas.root       // groups, edges, nodes
  └── canvas.overlay    // selection / hover strokes; future edit handles
```

### Validate loop

1. `store.replace(doc)` or `store.applyPatch(patch)` updates indexes and marks dirty ids (or `invalidateAll`).
2. Network sets `_needsPaint`; the RAF loop calls `validate()` when needed.
3. `validate()` recomputes bounds for dirty elements, unions dirty rects (or full frame), paints root, then overlay if required.
4. Viewport changes (pan, zoom, fit, resize) typically full-repaint root + overlay.

### Viewport

- Physical zoom only in v1 (`scale` the world → screen transform).
- API: `setZoom`, `panBy`, `fitBounds`, `setViewSize`, `worldToScreen`, `screenToWorld`.

### Painters

```ts
interface Painter {
  kind: string
  paint(ctx: CanvasRenderingContext2D, el: PaintElement, env: PaintEnv): void
  hitTest?(el: PaintElement, world: Point): boolean
  bounds(el: PaintElement): Rect
}
```

- Built-ins cover `group`, `edge`, default `node`, and at least one specialized kind used by fixtures (for example tool circles).
- Unknown node `kind` uses the default node painter; elements are never silently dropped.

### Hit testing

Top-down: overlay adornments (empty in v1 beyond selection stroke) → nodes → edges → groups. Configurable selection tolerance. Results write to Store transient state and emit network events.

### Performance target

About 500 elements with full-frame redraw is acceptable for v1. Simple dirty-rect union is enough; no virtualization or worker paint until a measured bottleneck exists.

## Interaction

```ts
interface Interaction {
  attach(network: Network): () => void
}
```

| Built-in | Behavior |
|---|---|
| `PanZoomInteraction` | wheel zoom, empty-space pan, fit helpers |
| `SelectInteraction` | click select; optional rubber-band |

- Gestures update transient selection/viewport only in v1.
- Document mutation via drag is deferred until `mode: 'draft'` editing work.
- Host-facing events: `element:click`, `element:dblclick`, `selection:change`, `viewport:change`.

## Demo acceptance

`vendor/aitopo/demo/` loads fixtures and must demonstrate:

1. Fleet-style topology fixture renders with groups, nodes, edges.
2. Flow-style pipeline fixture renders with kind-differentiated nodes.
3. Pan, zoom, fit, and selection highlight work on the overlay canvas.
4. Replacing the document (simulating a projection refresh) updates the scene without leaking RAF callbacks after dispose.

## Phase 2 — agent-canvas integration (contract only)

Do not implement in the engine milestone. When the demo is stable:

1. Keep derive/layout in the plugin (or feed layout x/y into the document).
2. Add a plugin-local adapter `toTopoDocument(snapshot | flow): TopoDocument`.
3. Replace SVG stage mounting with `network.mount(el)`; map click/dblclick to `openSession` / `showFlow`.
4. AITopo stays free of `@deepseek-ai/dsh-session` types; the adapter owns `SessionId` ↔ string.

Suggested seam (plugin-owned):

```
deriveClientTopology / derive-flow
  → toTopoDocument(...)
  → store.replace(doc)
CanvasView mounts Network instead of SVG
```

## Testing strategy (engine milestone)

- Unit: parse/reject invalid documents; diff/apply round-trip; bounds/hit-test for built-in painters.
- Demo manual or smoke: mount, paint, dispose, replace document.
- No agent-canvas snapshot updates until phase 2.

## Risks

| Risk | Mitigation |
|---|---|
| `vendor/` is usually upstream pins; aitopo is first-party | Document explicitly in README; do not run Cordis sync procedure against it |
| License confusion with SDK2D | Design-reference only; zero source copy; no twaver runtime dependency |
| Scope creep into editing/regeneration | `edit` fields stored but unused; no draft mutators in v1 |
| Premature plugin rewrite | Hard gate: demo acceptance before agent-canvas PRs |

## Open implementation choices (not design blockers)

- Exact `TopoPatch` encoding (JSON Patch vs structural op list).
- Whether demo uses Vite or a minimal static server.
- Whether `@neuravoxel-ai/aitopo` is listed in the root pnpm workspace immediately or linked only from demo until the first consumer lands.
