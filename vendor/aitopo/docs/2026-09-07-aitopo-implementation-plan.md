# AITopo implementation plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Do not skip Verify gates. Do not edit `plugins/agent-observe` until Part II.

**Goal:** Ship `@neuravoxel/aitopo` under `vendor/aitopo` — dual-face Canvas topology engine (Protocol + Scene/View/Renderer), dirty-rect paint, Alarm + single-level SubNetwork, vanilla demo. Then integrate into `plugins/agent-observe` (Part II).

**Design:** [vendor/aitopo/docs/2026-09-07-aitopo-design.md](./2026-09-07-aitopo-design.md)

**Tech:** TypeScript ESM, zod, Canvas 2D, Vite demo, vitest. No React, Cordis, or `@deepseek-ai/dsh-*` in the engine package. Zero imports from `vendor/SDK2D`.

---

## Part I — Engine (P0 → P1)

### Chunk 0 — Hazards (read first)

1. `pnpm-workspace.yaml` already includes `vendor/*`, so `vendor/aitopo` is a workspace member once `package.json` exists.
2. Pre-commit `scripts/check-vendor-manifest.sh` requires staging `vendor/README.md` whenever `vendor/*/src/**` changes. Add a **First-party libraries** section for aitopo (not an upstream Cordis pin). Do not follow [adding-a-vendored-package](../../../docs/cookbook/adding-a-vendored-package.md) as if this were a Cordis rescope.
3. Register `tsconfig.base.json` `paths` + a host project reference so source-plane imports resolve.
4. Stale tree: `vendor/aitopo/lib/` exists without `src/` / `package.json` and exports old `@neuravoxel-ai` / Topo* APIs. **Delete `lib/` and `node_modules/` in Task 1.0** before scaffolding; do not evolve the orphan declarations.
5. Ban-list for public names: `DataBox`, `ElementBox`, `ElementUI`, `s()`, `c()`, and other twaver identifiers.

---

### Chunk 1 — Scaffold

#### Task 1.0: Remove orphan artifacts

**Files:** delete `vendor/aitopo/lib/`, `vendor/aitopo/node_modules/` (local only; do not commit `node_modules`)

- [ ] **Step 1:** Remove stale `lib/` entirely.
- [ ] **Step 2:** Confirm no `src/` remains from the old attempt (if any stray files exist, delete them).

**Verify:** `vendor/aitopo/` contains only `docs/` (and empty dirs if any) before scaffold.

#### Task 1.1: Package + TypeScript + README

**Files:**
- Create `vendor/aitopo/package.json`
- Create `vendor/aitopo/tsconfig.json`
- Create `vendor/aitopo/README.md`
- Modify `vendor/README.md` (First-party section + SDK2D design-reference note)
- Modify `tsconfig.base.json` (`paths`: `"@neuravoxel/aitopo": ["./vendor/aitopo/src"]`)
- Modify `tsconfig.host.json` (project reference `{ "path": "./vendor/aitopo" }`)

- [ ] **Step 1:** `package.json`: `name: "@neuravoxel/aitopo"`, `private: true`, `"type": "module"`, dependency `zod`, scripts `test` / `demo` / `typecheck` as needed. No cordis peerDependency.
- [ ] **Step 2:** `tsconfig.json` extends repo base; `rootDir: src`, `outDir: lib/types`, `include: ["src"]`; keep `strict` on.
- [ ] **Step 3:** README: purpose, dual-face model, clean-room vs SDK2D, demo how-to, non-goals, link to design doc.
- [ ] **Step 4:** `vendor/README.md` First-party table row: directory, npm name, “not an upstream sync”, SDK2D is reference-only.
- [ ] **Step 5:** Register paths + project reference; `pnpm install`.

**Verify:** `pnpm install` OK; package filter resolves `@neuravoxel/aitopo`.

**Commit slice:** scaffold + `vendor/README.md` together.

---

### Chunk 2 — Protocol (P0)

#### Task 2.1: Types + zod + parse

**Files:**
- Create `vendor/aitopo/src/protocol/types.ts`
- Create `vendor/aitopo/src/protocol/schema.ts`
- Create `vendor/aitopo/src/protocol/parse.ts`
- Create `vendor/aitopo/src/protocol/index.ts`
- Create `vendor/aitopo/src/protocol/parse.spec.ts`

- [ ] **Step 1:** Implement `GraphDocument` (`version: 1`), `GraphNode`, `GraphEdge`, `GraphGroup`, `Alarm`, optional `networks` map per design.
- [ ] **Step 2:** Zod schemas; unknown `version` fails loud.
- [ ] **Step 3:** `parseDocument(input: unknown): GraphDocument`.
- [ ] **Step 4:** Tests: valid doc parses; missing `id` rejects; bad `version` rejects.

**Verify:** protocol parse specs green.

#### Task 2.2: Patch apply (immutable protocol helpers)

**Files:**
- Create `vendor/aitopo/src/protocol/patch.ts`
- Create `vendor/aitopo/src/protocol/patch.spec.ts`

- [ ] **Step 1:** Structural ops: add/update/remove for node|edge|group, `setAlarms`, `setViewport`, `setSelection` (selection may be transient-only at Network — still accept in patch schema if design keeps it).
- [ ] **Step 2:** `applyPatch(doc, patch): GraphDocument` — new object; never mutate inputs; validation failure throws before any write.
- [ ] **Step 3:** Optional `diffDocument(a, b)` if cheap; otherwise defer and load via full `replace` in tests.
- [ ] **Step 4:** Tests: upsert/remove round-trip; invalid op leaves conceptual “caller doc” unchanged (apply throws).

**Verify:** patch specs green.

#### Task 2.3: Event type definitions

**Files:**
- Create `vendor/aitopo/src/protocol/events.ts`

- [ ] **Step 1:** Discriminated `GraphEvent` union per design (`selectionChanged`, `hoverChanged`, `nodeActivated`, `viewportChanged`, `layoutCompleted`, `alarmChanged`, `subNetworkChanged`, optional `documentChanged`).
- [ ] **Step 2:** Export from `protocol/index.ts`. No emitter here — Network owns subscription.

**Verify:** types compile; exported from package barrel later.

---

### Chunk 3 — Model / Scene (P0–P1)

#### Task 3.1: GraphScene + indexes

**Files:**
- Create `vendor/aitopo/src/model/scene.ts`
- Create `vendor/aitopo/src/model/scene.spec.ts`
- Create `vendor/aitopo/src/model/index.ts`

- [ ] **Step 1:** Mutable scene: node/edge/group maps, adjacency, alarm index, `sceneVersion`, dirty id set.
- [ ] **Step 2:** `load(doc)`, `apply(patch)` — parse/validate at boundary, then mutate scene; failed apply rolls back or applies transactionally (prefer clone-swap: build next maps then commit).
- [ ] **Step 3:** `toJSON(): GraphDocument` from current scene (+ current subnetwork context).
- [ ] **Step 4:** Tests: load indexes; apply add/remove; failed patch does not change `sceneVersion`.

**Verify:** scene specs green.

#### Task 3.2: Alarm + SubNetwork stack

**Files:**
- Create `vendor/aitopo/src/model/alarm.ts` (types helpers if not only in protocol)
- Create `vendor/aitopo/src/model/subnetwork.ts`
- Create `vendor/aitopo/src/model/subnetwork.spec.ts`

- [ ] **Step 1:** Attach/replace alarms on node/edge; mark dirty; expose query helpers.
- [ ] **Step 2:** `enterSubNetwork(id)` / `exitSubNetwork()` — phase 1 single level (root ↔ one child from `doc.networks[id]`). Reject missing id loud.
- [ ] **Step 3:** Stack state readable for events; `toJSON` reflects active network document.
- [ ] **Step 4:** Tests: enter/exit; reject missing; alarm set dirties node id.

**Verify:** subnetwork + alarm specs green.

---

### Chunk 4 — Geom + dirty-rect (P0)

#### Task 4.1: Geometry helpers

**Files:**
- Create `vendor/aitopo/src/geom.ts`
- Create `vendor/aitopo/src/geom.spec.ts`

- [ ] **Step 1:** `Point`, `Rect`, `unionRect`, `intersectsRect`, `hitRect`, padding grow.
- [ ] **Step 2:** Unit tests for union and hit.

**Verify:** geom specs green.

#### Task 4.2: Dirty-rect accumulator

**Files:**
- Create `vendor/aitopo/src/network/dirty.ts`
- Create `vendor/aitopo/src/network/dirty.spec.ts`

- [ ] **Step 1:** Accumulate dirty element ids → resolve to world rects via view bounds → union; support `invalidateAll` flag.
- [ ] **Step 2:** Camera/resize sets `invalidateAll`.
- [ ] **Step 3:** Tests: two rects union; invalidateAll clears id set semantics.

**Verify:** dirty specs green.

---

### Chunk 5 — UI Views (P0)

#### Task 5.1: View base + node/edge/group

**Files:**
- Create `vendor/aitopo/src/ui/view.ts`
- Create `vendor/aitopo/src/ui/node-view.ts`
- Create `vendor/aitopo/src/ui/edge-view.ts`
- Create `vendor/aitopo/src/ui/group-view.ts`
- Create `vendor/aitopo/src/ui/alarm-badge.ts`
- Create `vendor/aitopo/src/ui/index.ts`
- Create `vendor/aitopo/src/ui/views.spec.ts`

- [ ] **Step 1:** `markDirty()` / `validate()` / `bounds()` / `hitTest(world)` / `paint(renderer)`.
- [ ] **Step 2:** Default rect node, polyline/bezier edge, group band; AlarmBadge for `error` emphasis.
- [ ] **Step 3:** Unknown `type` falls back to default node view (never drop silently).
- [ ] **Step 4:** Tests: bounds for rect node; hit inside/outside; alarm expands bounds if needed.

**Verify:** ui specs green.

---

### Chunk 6 — Renderer (P0)

#### Task 6.1: Interface + Canvas2D

**Files:**
- Create `vendor/aitopo/src/render/types.ts`
- Create `vendor/aitopo/src/render/canvas2d.ts`
- Create `vendor/aitopo/src/render/index.ts`

- [ ] **Step 1:** `Renderer` interface per design (`beginFrame(viewport, dirty)`, drawGroup/Edge/Node, `endFrame`).
- [ ] **Step 2:** `Canvas2DRenderer` owns or receives root+overlay contexts; applies clip from dirty rects in screen space; `debugPaintRects` option strokes unions.
- [ ] **Step 3:** On paint exception: log + request one full-frame invalidate (Network cooperates).

**Verify:** typecheck; minimal smoke via Network tests in Chunk 7.

---

### Chunk 7 — Network + Viewport + loop (P0)

#### Task 7.1: Viewport

**Files:**
- Create `vendor/aitopo/src/network/viewport.ts`
- Create `vendor/aitopo/src/network/viewport.spec.ts`

- [ ] **Step 1:** `{ x, y, zoom }` + view size; clamp zoom; `worldToScreen` / `screenToWorld`; `panBy`; `fitBounds`.
- [ ] **Step 2:** Unit tests for identity and fit.

**Verify:** viewport specs green.

#### Task 7.2: Network

**Files:**
- Create `vendor/aitopo/src/network/network.ts`
- Create `vendor/aitopo/src/network/events.ts` (emitter bridging to `GraphEvent`)
- Create `vendor/aitopo/src/network/index.ts`
- Create `vendor/aitopo/src/network/network.spec.ts`

- [ ] **Step 1:** Public API: `load`, `toJSON`, `apply`, `layout`, `enterSubNetwork`, `exitSubNetwork`, `on`, `mount`, `destroy` (match design; `enter`/`exit` may wrap scene + emit `subNetworkChanged`).
- [ ] **Step 2:** `mount`: `div.aitopo-view` + root/overlay canvases; ResizeObserver; default interactions attachable via options.
- [ ] **Step 3:** RAF loop: if dirty → validate views → dirty-rect paint root → overlay as needed.
- [ ] **Step 4:** `destroy` cancels RAF, removes DOM, clears listeners.
- [ ] **Step 5:** Emit GraphEvents for selection/hover/activate/viewport (layout/alarm/subnetwork when those APIs used).
- [ ] **Step 6:** Tests: mount/destroy; load schedules paint; destroy stops RAF (fake timers OK); apply invalid patch throws and scene unchanged.

**Verify:** network specs green.

---

### Chunk 8 — Interaction (P0)

#### Task 8.1: PanZoom + SelectActivate

**Files:**
- Create `vendor/aitopo/src/interaction/types.ts`
- Create `vendor/aitopo/src/interaction/pan-zoom.ts`
- Create `vendor/aitopo/src/interaction/select-activate.ts`
- Create `vendor/aitopo/src/interaction/index.ts`
- Create `vendor/aitopo/src/interaction/interaction.spec.ts`

- [ ] **Step 1:** `Interaction.attach(network) => disposer`.
- [ ] **Step 2:** Wheel zoom toward pointer; empty-space drag pans; camera change → full invalidate.
- [ ] **Step 3:** Hit-test select; click / dblclick → `nodeActivated` with detail; selection → `selectionChanged`.
- [ ] **Step 4:** Minimal synthetic pointer tests.

**Verify:** interaction specs green.

---

### Chunk 9 — Layout + fixtures (P1)

#### Task 9.1: Layouts

**Files:**
- Create `vendor/aitopo/src/layout/grid.ts`
- Create `vendor/aitopo/src/layout/flow.ts`
- Create `vendor/aitopo/src/layout/index.ts`
- Create `vendor/aitopo/src/layout/layout.spec.ts`

- [ ] **Step 1:** `layoutGrid` / `layoutFlowColumns` write coordinates on scene nodes/groups.
- [ ] **Step 2:** `network.layout(name)` calls helper, marks dirty, emits `layoutCompleted`.
- [ ] **Step 3:** Unit tests on pure layout functions with small graphs.

**Verify:** layout specs green.

#### Task 9.2: Fixtures

**Files:**
- Create `vendor/aitopo/fixtures/fleet.json`
- Create `vendor/aitopo/fixtures/flow.json`
- Create `vendor/aitopo/fixtures/teams-root.json` (root + one `networks.team-a` child)

- [ ] **Step 1:** Fleet-like groups/nodes/edges.
- [ ] **Step 2:** Flow-like step/tool nodes; at least one `alarms: [{ level: 'error', ... }]`.
- [ ] **Step 3:** Teams fixture for SubNetwork demo.
- [ ] **Step 4:** Spec or demo boot asserts `parseDocument` on all three.

**Verify:** fixtures parse.

---

### Chunk 10 — Public API + demo (P0/P1 gate)

#### Task 10.1: Barrel

**Files:**
- Create `vendor/aitopo/src/index.ts`

- [ ] **Step 1:** Export protocol types + parse/applyPatch, Network, Viewport, interactions, layouts, Canvas2D renderer factory, public GraphEvent types.
- [ ] **Step 2:** Do not export Scene/View internals (or mark `@internal` only if required for tests via deep import).

#### Task 10.2: Vite demo

**Files:**
- Create `vendor/aitopo/demo/index.html`
- Create `vendor/aitopo/demo/main.ts`
- Create `vendor/aitopo/demo/vite.config.ts`
- Update `package.json` `"demo"` script

- [ ] **Step 1:** Toolbar: Load fleet / flow / teams; Fit; Zoom ±; Apply sample patch (add node / setAlarms); Enter/Exit subnetwork; Toggle `debugPaintRects`.
- [ ] **Step 2:** Status line: selection id, active network, last event type.
- [ ] **Step 3:** README documents `pnpm --filter @neuravoxel/aitopo demo`.

**P1 acceptance checklist:**
- [ ] Load JSON document.
- [ ] Patch stream updates scene without remount.
- [ ] Error alarm badge visible.
- [ ] Enter/exit SubNetwork works for teams fixture.
- [ ] Pan/zoom/select work; destroy on HMR does not stack RAF loops.

---

### Chunk 11 — Agent Note + hardening

#### Task 11.1: Decision record

**Files:**
- Create `.agents/notes/proposed/architecture/2026-09-07-aitopo-dual-face-canvas-engine.md` (move to `implemented/` when code lands, per note workflow)

- [ ] **Step 1:** Record dual-face choice, clean-room boundary, dirty-rect, Alarm/SubNetwork scope, demo-before-plugin gate, `@neuravoxel/aitopo` under `vendor/`.
- [ ] **Step 2:** Link design + this plan.

#### Task 11.2: Final Part I checks

- [ ] **Step 1:** `pnpm --filter @neuravoxel/aitopo test` (or vitest path) green.
- [ ] **Step 2:** Root typecheck includes the project reference.
- [ ] **Step 3:** `rg "SDK2D|twaver" vendor/aitopo/src` is empty (comments may mention twaver only in README/docs).
- [ ] **Step 4:** No changes under `plugins/agent-observe`.

**Suggested Part I commits:**
1. Scaffold + vendor README + tsconfig
2. Protocol + Scene + Alarm/SubNetwork
3. Geom + dirty + UI + Renderer + Network
4. Interaction + layout + fixtures
5. Demo + Agent Note

Keep `vendor/README.md` staged in every commit that touches `vendor/aitopo/src/**`.

---

## Part II — agent-observe integration (P2 → P3)

> Start only after Part I P1 acceptance is signed off.
> **Integration design (approved):** [2026-09-07-aitopo-agent-observe-integration.md](./2026-09-07-aitopo-agent-observe-integration.md)
> **Scope decision:** Chunks 12 + 13 in one delivery; **no feature flag**; SVG path removed in the same change.

### Chunk 12 — Dependency + Fleet host

**Files:**
- Modify `plugins/agent-observe/package.json` (dependency `@neuravoxel/aitopo`)
- Create `plugins/agent-observe/src/client/aitopo/AITopoHost.tsx`
- Create `plugins/agent-observe/src/client/aitopo/snapshot-to-document.ts`
- Create `plugins/agent-observe/src/client/aitopo/flow-to-document.ts`
- Create `plugins/agent-observe/src/client/aitopo/alarms-from-status.ts`
- Modify `plugins/agent-observe/src/client/ObserveView.tsx` (Fleet stage → AITopoHost)
- Modify client locales if new strings appear (i18n gate)

- [ ] **Step 1:** Add workspace dependency; ensure client bundle resolves/inlines `@neuravoxel/aitopo`.
- [ ] **Step 2:** `AITopoHost`: `useEffect` mount/destroy; props `document` / `patch` / event callbacks / zoom bridge; no Session brands inside engine.
- [ ] **Step 3:** Adapters: `AgentObserveSnapshot` → `GraphDocument`; flow snapshot → document; map error/active → alarms/styles.
- [ ] **Step 4:** Wire Fleet click/dblclick to existing `openSession` / `showFlow`.
- [ ] **Step 5:** Toolbar zoom ± / fit / reset forward to Network viewport (replace `use-canvas-viewport` for Fleet).

**Verify:** `pnpm --filter dsh-agent-observe bundle`; manual Fleet open + dblclick flow.

### Chunk 13 — Flow + Teams + retire SVG

- [ ] **Step 1:** Flow pane uses AITopoHost; active/error styling + alarms; `hoverChanged` drives existing I/O tooltip.
- [ ] **Step 2:** When Teams data exists, map teams → SubNetwork; dblclick enters team graph; else keep unavailable hint.
- [ ] **Step 3:** Remove SVG drawing path, ZoomStage, and `use-canvas-viewport.ts` if unused.
- [ ] **Step 4:** Update plugin README (EN/ZH); run focused client checks / GIF for product-visible Canvas change per `docs/testing.md` + `record-browser-gif`.

**Verify:** Fleet + Flow parity; Teams drill-down when available; no SVG stage code remains.

---

## Out of scope (entire plan)

- Publishing `@neuravoxel/aitopo` to npm.
- WebGL renderer implementation (interface only).
- Multi-level SubNetwork UI beyond one drill level.
- Alarm propagation trees.
- UndoManager / Overview / HTML node UI.
- Model-visible DSH tools (`aitopo_*`).
- Copying or wrapping `vendor/SDK2D`.

---

## Progress

| Chunk | Status |
|---|---|
| 0 Hazards | done |
| 1 Scaffold | done |
| 2 Protocol | done |
| 3 Scene | done |
| 4 Dirty/geom | done |
| 5 UI | done |
| 6 Renderer | done |
| 7 Network | done |
| 8 Interaction | done |
| 9 Layout/fixtures | done |
| 10 Demo | done |
| 11 Note/harden | done |
| 12 Plugin Fleet | done (AITopo-only) |
| 13 Plugin Flow/Teams | done (same delivery as 12) |
