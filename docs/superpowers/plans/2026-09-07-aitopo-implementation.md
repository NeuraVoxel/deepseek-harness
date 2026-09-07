# AITopo implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans (or equivalent bite-sized execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@neuravoxel-ai/aitopo` under `vendor/aitopo` as a Document-first Canvas 2D topology engine with fixtures + demo — no `plugins/agent-canvas` changes.

**Architecture:** [docs/superpowers/specs/2026-09-07-aitopo-design.md](../specs/2026-09-07-aitopo-design.md)

**Tech stack:** TypeScript ESM, Canvas 2D, zod (document boundary), Vite for demo, vitest for unit tests.

---

## Chunk 0 — Repo placement hazards (read first)

`pnpm-workspace.yaml` already includes `vendor/*`, so `vendor/aitopo` becomes a workspace package automatically.

Caveats specific to this monorepo:

1. Pre-commit `check-vendor-manifest.sh` requires every commit that touches `vendor/*/src/**` to also stage `vendor/README.md`. Add a **First-party libraries** section there; do not pretend aitopo is an upstream Cordis pin.
2. Do not follow [docs/cookbook/adding-a-vendored-package.md](../../cookbook/adding-a-vendored-package.md) literally (that guide assumes `@deepseek-ai` rescope + publishable Cordis pins). AITopo stays `private: true` and `@neuravoxel-ai/aitopo`.
3. Still register `tsconfig.base.json` `paths` and a host project reference so source-plane imports resolve.
4. Zero imports from `vendor/SDK2D`. That tree is design reference only (and may be gitignored).

---

## Chunk 1 — Package scaffold

### Task 1.1: Create package manifest and TypeScript project

**Files:**
- Create `vendor/aitopo/package.json`
- Create `vendor/aitopo/tsconfig.json`
- Create `vendor/aitopo/README.md`
- Modify `vendor/README.md` (First-party section + note that SDK2D is reference-only if not already covered)
- Modify `tsconfig.base.json` (`paths`: `"@neuravoxel-ai/aitopo": ["./vendor/aitopo/src"]`)
- Modify `tsconfig.host.json` (add `{ "path": "./vendor/aitopo" }` with other vendor refs)

- [ ] **Step 1:** Write `package.json` with `name: "@neuravoxel-ai/aitopo"`, `private: true`, `"type": "module"`, exports for `.` → `src/index.ts` (or lib after build — match other private first-party patterns; prefer `src` export for source-plane + `lib` if the package joins root build).
- [ ] **Step 2:** Add dependency `zod` (document parse). No cordis peerDependency.
- [ ] **Step 3:** `tsconfig.json` extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: lib/types`, `include: ["src"]`. Keep strict options on (unlike relaxed Cordis vendor tsconfigs).
- [ ] **Step 4:** README states purpose, Document-first model, twaver.vector inspiration without source copy, demo how-to, non-goals (no agent-canvas yet).
- [ ] **Step 5:** Update `vendor/README.md` First-party section: directory, npm name, “not an upstream sync”, SDK2D reference policy.
- [ ] **Step 6:** Register paths + project reference; run `pnpm install`.
- [ ] **Step 7:** Commit scaffold + README updates together (satisfy vendor manifest guard).

**Verify:** `pnpm install` succeeds; `ls vendor/aitopo/package.json` exists.

---

## Chunk 2 — Document module

### Task 2.1: Types + zod schema + parse

**Files:**
- Create `vendor/aitopo/src/document/types.ts`
- Create `vendor/aitopo/src/document/schema.ts`
- Create `vendor/aitopo/src/document/parse.ts`
- Create `vendor/aitopo/src/document/index.ts`
- Create `vendor/aitopo/src/document/parse.spec.ts`

- [ ] **Step 1:** Implement `TopoStyle`, `TopoLayer`, `TopoNode`, `TopoEdge`, `TopoGroup`, `TopoDocument` as in the design spec (`schemaVersion: 1`).
- [ ] **Step 2:** Zod schemas mirroring those types; unknown `schemaVersion` fails.
- [ ] **Step 3:** `parseDocument(input: unknown): TopoDocument` — throws with a readable path message on failure.
- [ ] **Step 4:** Tests: valid fleet-like fixture parses; missing `id` rejects; wrong `schemaVersion` rejects; dangling edge endpoints are allowed at parse time (optional follow-up warning helper, not a hard fail in v1 unless cheap).

**Verify:** `pnpm exec vitest run vendor/aitopo/src/document/parse.spec.ts` (or package filter once wired).

### Task 2.2: Diff / apply patch

**Files:**
- Create `vendor/aitopo/src/document/patch.ts`
- Create `vendor/aitopo/src/document/patch.spec.ts`

- [ ] **Step 1:** Define structural `TopoPatch` ops: `{ op: 'replace'; document } | { op: 'upsert-node' | 'remove-node' | … }` covering node/edge/group (keep the op set small).
- [ ] **Step 2:** `diffDocument(a, b)` produces a patch that `applyPatch(a, patch)` deep-equals `b` for fixture pairs.
- [ ] **Step 3:** `applyPatch` returns a new document (immutable); never mutates inputs.
- [ ] **Step 4:** Tests for replace, upsert, remove, and round-trip.

**Verify:** patch specs green.

---

## Chunk 3 — Store

### Task 3.1: Indexes + transient state

**Files:**
- Create `vendor/aitopo/src/store/store.ts`
- Create `vendor/aitopo/src/store/store.spec.ts`
- Create `vendor/aitopo/src/store/index.ts`

- [ ] **Step 1:** `TopoStore` holds current `TopoDocument`, maps by id for nodes/edges/groups, and transient `{ selection: Set<string>, hoverId?: string }`.
- [ ] **Step 2:** `replace(doc)`, `applyPatch(patch)`, `setSelection`, `setHover`; each notifies subscribers with a change reason (`document` | `selection` | `hover`).
- [ ] **Step 3:** Document changes compute dirty ids (or `invalidateAll` flag) exposed to Network.
- [ ] **Step 4:** Tests: replace notifies; selection does not clear document; dispose/unsubscribe works.

**Verify:** store specs green.

---

## Chunk 4 — Network + Viewport + paint loop

### Task 4.1: Viewport math

**Files:**
- Create `vendor/aitopo/src/network/viewport.ts`
- Create `vendor/aitopo/src/network/viewport.spec.ts`

- [ ] **Step 1:** State `{ x, y, zoom }`, view size `{ width, height }`.
- [ ] **Step 2:** `worldToScreen` / `screenToWorld`, `panBy`, `setZoom` (clamped), `fitBounds(bounds, padding)`.
- [ ] **Step 3:** Unit tests for identity transform and fit centering.

### Task 4.2: Network mount + RAF validate

**Files:**
- Create `vendor/aitopo/src/network/network.ts`
- Create `vendor/aitopo/src/network/dirty.ts`
- Create `vendor/aitopo/src/network/events.ts`
- Create `vendor/aitopo/src/network/index.ts`
- Create `vendor/aitopo/src/network/network.spec.ts` (jsdom or happy-dom + stub canvas if needed)

- [ ] **Step 1:** `mount(parent: HTMLElement)` creates `div.aitopo-view` + `canvas.root` + `canvas.overlay`; size to parent; listen resize (ResizeObserver).
- [ ] **Step 2:** Subscribe to store; on document change mark dirty / invalidateAll; on selection/hover mark overlay dirty.
- [ ] **Step 3:** RAF loop: if needs paint → `validate()` → paint root (groups → edges → nodes by layer) → paint overlay (selection/hover strokes) → clear dirty.
- [ ] **Step 4:** `dispose()` cancels RAF, removes DOM, unsubscribes store, detaches interactions.
- [ ] **Step 5:** Emit typed events: `element:click`, `element:dblclick`, `selection:change`, `viewport:change`.
- [ ] **Step 6:** Tests: mount/dispose does not throw; replace document schedules paint; dispose stops further RAF work (use fake timers if helpful).

**Verify:** viewport + network specs green.

---

## Chunk 5 — Painters + hit testing

### Task 5.1: Painter registry and built-ins

**Files:**
- Create `vendor/aitopo/src/painters/types.ts`
- Create `vendor/aitopo/src/painters/registry.ts`
- Create `vendor/aitopo/src/painters/group.ts`
- Create `vendor/aitopo/src/painters/edge.ts`
- Create `vendor/aitopo/src/painters/node.ts`
- Create `vendor/aitopo/src/painters/tool-node.ts` (circle variant for flow tools)
- Create `vendor/aitopo/src/painters/index.ts`
- Create `vendor/aitopo/src/painters/painters.spec.ts`

- [ ] **Step 1:** `Painter` interface per design (`kind`, `paint`, `hitTest`, `bounds`).
- [ ] **Step 2:** Default registry: `group`, `edge`, `node`, `tool` (or `node:tool` — pick one and document it in README).
- [ ] **Step 3:** Unknown node kinds fall back to default `node` painter.
- [ ] **Step 4:** Hit-test: nodes before edges before groups; selection tolerance constant configurable on Network.
- [ ] **Step 5:** Tests for bounds of rect node and circle tool; hit inside/outside.

**Verify:** painter specs green.

---

## Chunk 6 — Interaction

### Task 6.1: PanZoom + Select

**Files:**
- Create `vendor/aitopo/src/interaction/types.ts`
- Create `vendor/aitopo/src/interaction/pan-zoom.ts`
- Create `vendor/aitopo/src/interaction/select.ts`
- Create `vendor/aitopo/src/interaction/index.ts`
- Create `vendor/aitopo/src/interaction/interaction.spec.ts`

- [ ] **Step 1:** `Interaction.attach(network) => disposer`.
- [ ] **Step 2:** `PanZoomInteraction`: wheel zoom toward cursor, pointer drag on empty space pans, optional `fit` helper callable from demo toolbar.
- [ ] **Step 3:** `SelectInteraction`: pointer down hit-test → set selection; emit click/dblclick; do not mutate document.
- [ ] **Step 4:** Tests with synthetic pointer events on a mounted network (minimal).

**Verify:** interaction specs green.

---

## Chunk 7 — Layout helpers + fixtures

### Task 7.1: Demo layouts and sample documents

**Files:**
- Create `vendor/aitopo/src/layout/grid.ts`
- Create `vendor/aitopo/src/layout/flow.ts`
- Create `vendor/aitopo/src/layout/index.ts`
- Create `vendor/aitopo/fixtures/fleet.json`
- Create `vendor/aitopo/fixtures/flow.json`

- [ ] **Step 1:** Grid layout places nodes into labeled groups (fleet-like).
- [ ] **Step 2:** Layered flow layout places a left-to-right pipeline with tool side nodes.
- [ ] **Step 3:** Hand-authored or generated fixtures include `mode: "projection"`, at least one node with unused `edit.regeneratable: true` to prove the field round-trips.
- [ ] **Step 4:** Fixtures parse via `parseDocument`.

**Verify:** `parseDocument` on both fixtures in a small spec or demo boot assert.

---

## Chunk 8 — Public API + demo app

### Task 8.1: Barrel export

**Files:**
- Create `vendor/aitopo/src/index.ts`

- [ ] **Step 1:** Export document parse/diff/apply, Store, Network, Viewport, interactions, painters registry, layout helpers, and public types.
- [ ] **Step 2:** Keep internal dirty/paint helpers unexported unless needed.

### Task 8.2: Vite demo

**Files:**
- Create `vendor/aitopo/demo/index.html`
- Create `vendor/aitopo/demo/main.ts`
- Create `vendor/aitopo/demo/vite.config.ts`
- Create `vendor/aitopo/package.json` scripts: `"demo": "vite --config demo/vite.config.ts"`

- [ ] **Step 1:** Demo page with toolbar: Load fleet / Load flow / Fit / Zoom ± / Replace doc (toggle fixture to simulate projection refresh).
- [ ] **Step 2:** Mount Network; attach PanZoom + Select; show selected id in a status line.
- [ ] **Step 3:** README documents `pnpm --filter @neuravoxel-ai/aitopo demo`.
- [ ] **Step 4:** Manual acceptance against design “Demo acceptance” checklist.

**Verify:** Demo runs locally; dispose on hot reload does not stack RAF loops.

---

## Chunk 9 — Hardening + Agent Note

### Task 9.1: Decision record

**Files:**
- Create `.agents/notes/implemented/architecture/2026-09-07-aitopo-document-first-canvas-engine.md` (or `proposed/` if not yet merged — prefer `proposed/` until code ships, then move with the landing PR per note workflow)

- [ ] **Step 1:** Record Document-first choice, twaver inspiration boundary, vendor first-party exception, demo-before-plugin gate.
- [ ] **Step 2:** Link the design spec and this plan.

### Task 9.2: Final checks

- [ ] **Step 1:** `pnpm exec vitest run` filtered to `vendor/aitopo` (or package test script).
- [ ] **Step 2:** `pnpm run typecheck` including the new project reference.
- [ ] **Step 3:** Confirm no files under `plugins/agent-canvas` changed.
- [ ] **Step 4:** Confirm no imports of `vendor/SDK2D`.

---

## Out of scope (do not implement in this plan)

- Any edit to `plugins/agent-canvas`.
- Model-visible tools.
- Draft-mode node dragging / Agent regeneration.
- Overview, Undo, Alarm, HTML painters.
- Publishing `@neuravoxel-ai/aitopo` to npm.

## Phase 2 handoff (separate plan later)

When demo acceptance is signed off, write a follow-up plan: plugin adapter `toTopoDocument`, replace SVG stage, map click/dblclick to existing session/flow actions, update agent-canvas snapshots if product-visible.

---

## Suggested commit slices

1. Scaffold + vendor README + tsconfig wiring
2. Document + Store
3. Network + Viewport + Painters
4. Interaction + fixtures
5. Demo + Agent Note

Keep `vendor/README.md` in every commit that touches `vendor/aitopo/src/**`.
