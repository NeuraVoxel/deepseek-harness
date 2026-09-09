# AITopo Editor Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Do not skip Verify gates. Do **not** edit `plugins/agent-orchestrator` edit chrome in this plan — engine + demo only; orchestrator F1 is a follow-up once these APIs ship.

**Goal:** Ship the AITopo Editor milestone (AT-E1–E6, AT-E8, AT-E9) so `dsh-agent-orchestrator` F1 can enable edit chrome solely through public `@neuravoxel/aitopo` Network / Interaction APIs.

**Requirements:** [2026-09-08-aitopo-editor-requirements.md](./2026-09-08-aitopo-editor-requirements.md)

**Architecture:** Keep dual-face Protocol + Network. Editor gestures are pluggable `Interaction` modules that commit durable changes via existing `GraphPatch` ops (`updateNode` / `updateGroup` / `setSelection`) and emit dedicated `GraphEvent` discriminants. Optional `PatchHistory` owns undo/redo as inverse patch apply. No React, Cordis, or `@deepseek-ai/dsh-*` inside the engine.

**Tech Stack:** TypeScript ESM, zod, Canvas 2D, Vite demo, vitest (`environment: 'node'` + mocked `InteractionHost`).

**Design reference (read-only):** `vendor/SDK2D/twaver/vector/` — ideas only. Clean-room rewrite: **no** SDK2D imports, **no** twaver public names (`DataBox`, `ElementBox`, `ElementUI`, `s()` / `c()`, `DefaultInteraction`, etc.). `SDK2D/` is gitignored design-reference; see `vendor/README.md`.

**Out of scope here:** AT-E7 (CreateEdge — orchestrator F2); orchestrator F1 UI; agent-observe changes; View-class rewrite from Phase 1; twaver `EditInteraction` resize/rotate/link-point editing.

---

## Design reference map (`twaver.vector` → AITopo)

Primary sources under `vendor/SDK2D/`:

| Reference path | Idea to borrow |
|---|---|
| `twaver/vector/interaction/BaseInteraction.js` | Marker/overlay paint hook; logical↔view point conversion; attach/tearDown listener pattern → `Interaction.attach → disposer` |
| `twaver/vector/interaction/DefaultInteraction.js` | Live vs lazy move; move **selected movable** set; rect-select overlay; empty-space pan; parenting during move |
| `twaver/vector/Network.js` | `isMovable` gate; `moveSelectedElements`; `setEditInteractions` / interaction list; dual canvas + top-canvas markers |
| `twaver/vector/GroupUI.js` | Group outline via style (`vector.outline.pattern` / shape) → `GraphGroup.style.strokeDash` |
| `twaver/Element.js` (`_movable`) | Per-element movable flag → `GraphNode.locked` (inverted: locked means not movable) |
| `twaver/UndoManager.js` | Stack of reversible box mutations → **protocol-level** `PatchHistory` (patches, not property-change listeners) |
| `twaver/vector/interaction/CreateLinkInteraction.js` | From/to rubber-band (AT-E7 later only) |
| `twaver/vector/interaction/EditInteraction.js` | Resize/rotate handles — **not** in Editor F1 |

### Behavioral notes (implement against these, not twaver names)

1. **Move (AT-E1)** — Prefer twaver **live move** (`lazyMode === false`): update positions during drag; emit commit event on pointer-up. Optional later: lazy ghost outline on overlay (`lazyMoveOutline*` styles) without renaming to twaver terms. Move **all selected unlocked nodes** by the same delta (twaver `moveSelectedElements`), not only the hit target.
2. **Movable gate (AT-E5)** — twaver checks `element.isMovable()` + layer + optional `movableFunction`. AITopo collapses to `node.locked === true` → skip move and membership edit. Selection may still include locked nodes.
3. **Group membership (AT-E3)** — twaver reparents only while **P** is held (`parentProcess` + `setParent`). Orchestrator needs drop-into-band without a chord key: on move end, hit-test group under pointer and patch `memberIds` / `groupId`. Still paint a temporary highlight on the target group during drag when a hit exists (twaver `parentRect` overlay idea).
4. **Marquee (AT-E6)** — twaver rect-select paints on top canvas (`selectStart` / `selectBetween` / `selectEnd`); intersect vs contain mode. AITopo: Shift+empty drag; intersect mode only for F1; overlay stroke on Network overlay canvas.
5. **External drop (AT-E2)** — Not part of vector `DefaultInteraction`; HTML5 DnD is host-side in twaver demos/tests. Keep opaque `externalDrop` event; engine does not invent catalog nodes.
6. **Undo (AT-E8)** — Do **not** mirror `UndoManager`’s DataBox property listeners. Record `GraphPatch` forward/inverse pairs so hosts and models share one history unit.
7. **Interaction packing** — twaver `setEditInteractions` stacks Edit + Default (+ optional MoveLink). AITopo: `Network({ interactions: [MoveNode, ExternalDrop, MarqueeSelect, …] })` beside defaults; no `setEdit*` API names.

---

## Decisions (lock open choices from requirements)

| Topic | Choice |
|---|---|
| Event names | Dedicated discriminants: `nodeMoved`, `groupMembershipChanged`, `externalDrop` (not only `documentChanged` metadata) |
| Drop target | Free canvas: engine emits scene `{ x, y }` + opaque `dataTransfer` payload; **host** decides addNode / membership |
| AT-E8 | Engine ships optional `PatchHistory` (push applied patches; `undo`/`redo` → inverse `apply`). Host may ignore and own its own stack |
| `locked` | First-class `GraphNode.locked?: boolean` (not only `data.locked`). Move / membership skip when `locked === true` |
| Group style | First-class `GraphGroup.style?: { stroke?, strokeWidth?, strokeDash?: number[] }` |
| Pointer composition | Drag threshold (4px screen) before move/marquee; `SelectActivate` suppresses activation when a drag gesture consumed the pointer; PanZoom still only on empty space |
| Multi-select move | Drag moves **all selected unlocked** nodes by one delta (twaver `moveSelectedElements` idea); emit one `nodeMoved` per moved id **or** a single batch documented in events — **choose:** emit `nodeMoved` per id for simple host mirroring |
| Feature detection | Export named interaction classes; hosts check `typeof MoveNodeInteraction === 'function'` (or import) before enabling edit chrome |
| SDK2D reference | Consult `vendor/SDK2D/twaver/vector/interaction/{Base,Default}Interaction.js` + `Network.js` while coding; never import or copy identifiers into `vendor/aitopo/src` |

---

## File map

```
vendor/aitopo/
  src/
    protocol/
      types.ts          # + locked, GraphGroup.style
      schema.ts         # zod for locked + style
      events.ts         # + nodeMoved, groupMembershipChanged, externalDrop
      patch-history.ts  # NEW — PatchHistory (AT-E8)
      invert.ts         # NEW — invertPatch(op) helpers
    interaction/
      types.ts          # extend InteractionHost for editor
      move-node.ts      # NEW — AT-E1 (+ AT-E3 membership on drop)
      external-drop.ts  # NEW — AT-E2
      marquee-select.ts # NEW — AT-E6
      select-activate.ts# suppress click after drag
      index.ts          # export new interactions
    render/canvas2d.ts  # AT-E4 stroke styles
    network/network.ts  # host helpers: preview move, hitTestGroup, emit, consumeDrag
    index.ts            # public exports
  fixtures/editor.json  # NEW — locked node + dashed group
  demo/main.ts          # Editor toolbar mode
  tests/
    editor-protocol.spec.ts
    move-node.spec.ts
    external-drop.spec.ts
    marquee.spec.ts
    patch-history.spec.ts
  docs/2026-09-08-aitopo-editor-requirements.md  # status → accepted; link this plan
  README.md
```

---

## Chunk 0 — Protocol: locked + group style + events

### Task 0.1: Types + zod

**Files:**
- Modify: `vendor/aitopo/src/protocol/types.ts`
- Modify: `vendor/aitopo/src/protocol/schema.ts`
- Create: `vendor/aitopo/tests/editor-protocol.spec.ts`

- [ ] **Step 1: Extend GraphNode / GraphGroup**

```ts
// GraphNode — add:
readonly locked?: boolean

// GraphGroup — add:
readonly style?: {
  readonly stroke?: string
  readonly strokeWidth?: number
  /** Canvas setLineDash segments in world px. */
  readonly strokeDash?: readonly number[]
  readonly fill?: string
}
```

- [ ] **Step 2: Extend zod**

```ts
// graphNodeSchema — add:
locked: z.boolean().optional(),

// graphGroupSchema — add:
style: z.object({
  stroke: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  strokeDash: z.array(z.number()).optional(),
  fill: z.string().optional(),
}).optional(),
```

- [ ] **Step 3: Failing then passing parse tests**

```ts
it('accepts locked node and dashed group style', () => {
  const doc = parseDocument({
    version: 1,
    nodes: [{ id: 'a', type: 'unit', label: 'A', locked: true, x: 0, y: 0 }],
    edges: [],
    groups: [{
      id: 'g',
      label: 'Composition',
      memberIds: ['a'],
      style: { stroke: '#22c55e', strokeWidth: 2, strokeDash: [8, 4] },
    }],
  })
  expect(doc.nodes[0]?.locked).toBe(true)
  expect(doc.groups?.[0]?.style?.strokeDash).toEqual([8, 4])
})
```

**Verify:** `pnpm --filter @neuravoxel/aitopo test -- tests/editor-protocol.spec.ts`

---

### Task 0.2: Editor GraphEvents

**Files:**
- Modify: `vendor/aitopo/src/protocol/events.ts`
- Modify: `vendor/aitopo/src/protocol/index.ts` (re-export if needed)

- [ ] **Step 1: Add event interfaces**

```ts
export interface NodeMovedEvent {
  readonly type: 'nodeMoved'
  readonly nodeId: string
  readonly from: { readonly x: number; readonly y: number }
  readonly to: { readonly x: number; readonly y: number }
}

export interface GroupMembershipChangedEvent {
  readonly type: 'groupMembershipChanged'
  readonly nodeId: string
  readonly fromGroupId: string | undefined
  readonly toGroupId: string | undefined
}

/** Opaque catalog drop — engine does not parse `data`. */
export interface ExternalDropEvent {
  readonly type: 'externalDrop'
  readonly x: number
  readonly y: number
  readonly data: string
  readonly groupId?: string
}

// Add all three to GraphEvent union.
```

**Verify:** `pnpm --filter @neuravoxel/aitopo typecheck`

---

## Chunk 1 — InteractionHost + Network helpers

### Task 1.1: Extend InteractionHost

**Files:**
- Modify: `vendor/aitopo/src/interaction/types.ts`
- Modify: `vendor/aitopo/src/network/network.ts`
- Modify: `vendor/aitopo/src/ui/bounds.ts` (add `hitTestGroups` if missing)

- [x] **Step 1: Widen host surface**

```ts
export interface InteractionHost {
  // existing…
  getNode(id: string): GraphNode | undefined
  getGroups(): readonly GraphGroup[]
  hitTestGroupScreen(screenX: number, screenY: number): string | undefined
  screenToWorld(screenX: number, screenY: number): { x: number; y: number }
  /** Live preview during drag (does not emit nodeMoved). */
  previewNodePosition(id: string, x: number, y: number): void
  /**
   * Commit move: apply updateNode, optional membership patch, emit nodeMoved
   * and groupMembershipChanged when membership changes.
   */
  commitNodeMove(args: {
    nodeId: string
    from: { x: number; y: number }
    to: { x: number; y: number }
    toGroupId?: string | undefined
  }): void
  /** Mark that a drag consumed this pointer gesture (SelectActivate skips activate). */
  markGestureDragged(): void
  wasGestureDragged(): boolean
  clearGestureDragged(): void
  emit(event: GraphEvent): void
  apply(patch: GraphPatch): void
}
```

- [x] **Step 2: Implement on Network**

- `getNode` / `getGroups` from `scene`
- `hitTestGroupScreen` → screenToWorld → `hitTestGroups` (topmost group containing point; prefer smallest area on ties)
- `previewNodePosition`: mutate scene node x/y via internal scene write or `apply({ ops: [{ op: 'updateNode', … }] })` **without** emitting `nodeMoved` (emit only `documentChanged` with reason `preview` **or** skip documentChanged — prefer **no** durable event on preview; use a scene-only `writePositions` path already used by layout)
- `commitNodeMove`: build patch `updateNode` (+ `updateGroup` memberIds when `toGroupId` differs from current); `apply`; emit `nodeMoved`; emit `groupMembershipChanged` if membership changed
- Gesture drag flags: private boolean reset on next pointerdown via SelectActivate / MoveNode calling `clearGestureDragged` at start

- [x] **Step 3: SelectActivate — skip activate after drag**

At start of `pointerdown`: `network.clearGestureDragged()`.
On activation path: if `network.wasGestureDragged()` return without `activateNode`.

**Verify:** typecheck; existing tests still green.

---

## Chunk 2 — AT-E4 Group stroke styles (paint)

### Task 2.1: Canvas2D drawGroup

**Files:**
- Modify: `vendor/aitopo/src/render/canvas2d.ts`
- Modify: `vendor/aitopo/tests/editor-protocol.spec.ts` or add paint unit via style read helpers

- [x] **Step 1: Respect `group.style`**

```ts
drawGroup(group: GraphGroup, view: GroupPaintView): void {
  const style = group.style ?? {}
  const stroke = style.stroke ?? '#5a6478'
  const fill = style.fill ?? 'rgba(90, 100, 120, 0.08)'
  const width = (style.strokeWidth ?? 1) / this.viewport.zoom
  // …
  ctx.setLineDash((style.strokeDash ?? []).map(d => d /* world dash; scale if needed */))
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
  ctx.setLineDash([])
}
```

**Verify:** demo/fixture visual later; unit test that style fields survive parse + `toJSON` round-trip through scene.

---

## Chunk 3 — AT-E1 + AT-E3 + AT-E5 Move / membership / lock

### Task 3.1: MoveNodeInteraction

**Files:**
- Create: `vendor/aitopo/src/interaction/move-node.ts`
- Create: `vendor/aitopo/tests/move-node.spec.ts`
- Modify: `vendor/aitopo/src/interaction/index.ts`

- [x] **Step 1: Write failing tests with mock host**

```ts
it('skips locked nodes', () => {
  const host = createMockHost({
    nodes: [{ id: 'a', type: 'u', label: 'A', locked: true, x: 10, y: 20 }],
  })
  const dispose = new MoveNodeInteraction().attach(host)
  // simulate pointerdown on a + move 20px + up
  expect(host.commitNodeMove).not.toHaveBeenCalled()
  dispose()
})

it('commits unlock move and emits via host.commitNodeMove', () => {
  const host = createMockHost({
    nodes: [{ id: 'a', type: 'u', label: 'A', x: 10, y: 20 }],
  })
  // pointerdown → move past threshold → pointerup
  expect(host.commitNodeMove).toHaveBeenCalledWith(expect.objectContaining({
    nodeId: 'a',
    from: { x: 10, y: 20 },
  }))
})

it('updates membership when dropped into another group', () => {
  // host.hitTestGroupScreen returns 'g2' on up; expect toGroupId: 'g2'
})
```

- [x] **Step 2: Implement MoveNodeInteraction**

Behavior (aligned with `DefaultInteraction` live-move + selection set):
1. `pointerdown` on node hit (button 0): if hit node `locked === true` **and** no other selected unlocked nodes, ignore. If hit is unlocked (or selection has unlocked members), prepare move of **all selected unlocked** ids; if hit was not selected, replace selection with `[hit]` first (twaver-style).
2. Track start screen + per-node start world positions; do not capture until moved ≥ 4px (filter noise; twaver uses ~1 logical px).
3. On threshold: `markGestureDragged()`, `setPointerCapture`, start live preview (prefer live over lazy ghost for F1).
4. `pointermove`: `previewNodePosition` for each moving id with shared delta / zoom; optional overlay highlight of `hitTestGroupScreen` target (twaver `parentRect`).
5. `pointerup`: if dragged, for each moved id `commitNodeMove` (membership from group under pointer applies to **unlocked** movers only); else leave to SelectActivate.
6. Empty-space downs ignored (PanZoom / Marquee own those).

Membership rules:
- If pointer-up group differs from node's current `groupId`, include membership change.
- Locked nodes never leave/enter groups via this interaction.
- Removing membership (drop outside all groups): `toGroupId: undefined` clears `groupId` and removes id from previous group's `memberIds`.
- Do **not** require a P-key chord (twaver-only); automatic group hit is the Editor contract.

- [x] **Step 3: Export from interaction/index + package barrel**

- [x] **Step 4: While coding, skim reference (do not copy)**

Read for behavior only:
- `vendor/SDK2D/twaver/vector/interaction/DefaultInteraction.js` — `handle_mousedown` / `handle_mousemove` / `end` move + select paths; `paint` rect-select + lazy outline
- `vendor/SDK2D/twaver/vector/Network.js` — `isMovable`, `moveSelectedElements`
Confirm: no `twaver` / `SDK2D` strings in `vendor/aitopo/src` except README/docs.

**Verify:** `pnpm --filter @neuravoxel/aitopo test -- tests/move-node.spec.ts`

---

## Chunk 4 — AT-E2 External drop

### Task 4.1: ExternalDropInteraction

**Files:**
- Create: `vendor/aitopo/src/interaction/external-drop.ts`
- Create: `vendor/aitopo/tests/external-drop.spec.ts`

- [x] **Step 1: Tests**

```ts
it('emits externalDrop with world coords and opaque data', () => {
  // dispatch dragover preventDefault + drop with dataTransfer.getData('text/plain')
  expect(host.emit).toHaveBeenCalledWith({
    type: 'externalDrop',
    x: expect.any(Number),
    y: expect.any(Number),
    data: 'catalog:shell',
    groupId: undefined, // or hit group id when over a band
  })
})
```

- [x] **Step 2: Implement**

- Listen on `getViewElement()` for `dragover` (preventDefault) and `drop`.
- Read `text/plain` first; if empty, try `application/aitopo-drop` (document both).
- Map client → screen → world; optional `groupId` from `hitTestGroupScreen`.
- `emit({ type: 'externalDrop', … })` only — **do not** auto `addNode` (host owns catalog semantics).

**Verify:** external-drop specs green.

---

## Chunk 5 — AT-E6 Marquee select

### Task 5.1: MarqueeSelectInteraction

**Files:**
- Create: `vendor/aitopo/src/interaction/marquee-select.ts`
- Create: `vendor/aitopo/tests/marquee.spec.ts`
- Modify: Network overlay paint path to draw marquee rect when `scene.marquee` or host callback — **prefer**: Marquee keeps local rect and calls `network.setMarqueeRect(rect | undefined)` painted on overlay in `validate()`.

- [x] **Step 1: Tests** — empty-space drag selects nodes whose bounds intersect marquee; locked nodes may still be selected (lock blocks move, not select); Shift appends (optional — if skipped, document replace-only).

- [x] **Step 2: Implement**

- `pointerdown` only when `hitTestScreen` is undefined (do not fight MoveNode).
- Coordinate with PanZoom: **attach order matters**. Network default order should be: `ExternalDrop`, `MoveNode`, `MarqueeSelect`, `SelectActivate`, `PanZoom` when editor interactions are enabled via options; **or** Marquee uses Alt/Shift modifier so PanZoom keeps unmodified empty drag.

**Decision for this plan:** Marquee requires **Shift+drag** on empty space; unmodified empty drag remains pan. Document in README. PanZoom skips `pointerdown` when `shiftKey` is set.

- [x] **Step 3: Overlay marquee stroke** during drag; on up `setSelection(ids)`.

**Verify:** marquee specs green.

**Selection mode:** replace-only on pointerup (no Shift-append).

---

## Chunk 6 — AT-E8 PatchHistory

### Task 6.1: invert + history

**Files:**
- Create: `vendor/aitopo/src/protocol/invert.ts`
- Create: `vendor/aitopo/src/protocol/patch-history.ts`
- Create: `vendor/aitopo/tests/patch-history.spec.ts`
- Modify: `vendor/aitopo/src/protocol/index.ts`, `src/index.ts`

- [x] **Step 1: `invertOp(beforeDoc, op) → GraphPatchOp | GraphPatchOp[]`**

Supported inverses (minimum for Editor):
| Forward | Inverse |
|---|---|
| `updateNode` | `updateNode` with previous field snapshot for changed keys |
| `updateGroup` | `updateGroup` with previous memberIds/style/geom |
| `addNode` | `removeNode` |
| `removeNode` | `addNode` (full prior node) + cascaded `addEdge` |
| `addGroup` / `removeGroup` | symmetric |
| `setViewport` / `setAlarms` | restore prior |
| `setSelection` / SubNetwork nav | **skip** (`[]`) — Network runtime; `applyPatch` no-ops them |

Throw or no-op with documented skip for unsupported ops.

- [x] **Step 2: PatchHistory**

```ts
export class PatchHistory {
  constructor(private readonly apply: (patch: GraphPatch) => void, private readonly getDoc: () => GraphDocument)
  /** Record a patch that was already applied (or apply+push). */
  pushApplied(forward: GraphPatch): void
  undo(): boolean
  redo(): boolean
  clear(): void
}
```

Recommended API: `pushAndApply(forward)` that snapshots doc, applies, stores `{ forward, inverse }`.

- [x] **Step 3: Tests** — move updateNode undo restores x/y; redo reapplies; failed apply does not push.

**Verify:** patch-history specs green.

---

## Chunk 7 — AT-E9 Demo + README + fixture

### Task 7.1: Editor fixture + demo mode

**Files:**
- Create: `vendor/aitopo/fixtures/editor.json`
- Modify: `vendor/aitopo/demo/main.ts`, `demo/index.html` if needed
- Modify: `vendor/aitopo/README.md`
- Modify: `vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md` (status + decisions)
- Create: `.agents/notes/proposed/architecture/2026-09-09-aitopo-editor-interactions.md` (or `implemented/` when merged)

- [x] **Step 1: `fixtures/editor.json`**

- Composition group with dashed green stroke; catalog group solid gray.
- One `locked: true` core node inside composition; one unlocked movable node.
- Enough spacing for drag / marquee.

- [x] **Step 2: Demo toolbar**

- Button **Editor**: load fixture; attach `MoveNodeInteraction`, `ExternalDropInteraction`, `MarqueeSelectInteraction` (via `new Network({ interactions: […] })` or remount).
- Status line shows `nodeMoved` / `externalDrop` / `groupMembershipChanged`.
- Drop stub: listen `externalDrop` → `apply(addNode)` at coords (demo-only host behavior).
- Optional Undo/Redo buttons wired to `PatchHistory`.

- [x] **Step 3: README**

List Editor interactions, events, `locked`, group `style`, `PatchHistory`, Shift+marquee, drop MIME types. State observation demos unchanged.

- [x] **Step 4: Requirements doc**

Set status to accepted; replace Open choices with Decisions table pointing at this plan.

**P1 Editor acceptance checklist:**
- [x] Drag unlocked node updates position; locked skipped.
- [x] Drop stub adds node via `externalDrop` + host apply.
- [x] Dashed composition group visible.
- [x] Shift-marquee selects multiple.
- [x] Undo/Redo via PatchHistory restores last move.
- [x] No React / DSH deps in package.json.
- [x] Unit tests cover AT-E1–E6, E8.

**Verify:**
```sh
pnpm --filter @neuravoxel/aitopo test
pnpm --filter @neuravoxel/aitopo typecheck
rg "SDK2D|from 'twaver|from \"twaver" vendor/aitopo/src || true
# manual: pnpm --filter @neuravoxel/aitopo demo → Editor
```

---

## Suggested commits

1. Protocol: locked + group style + editor events + parse tests
2. InteractionHost / Network helpers + SelectActivate drag suppress
3. MoveNode + membership + lock tests
4. ExternalDrop + Marquee
5. PatchHistory + invert
6. Demo fixture + README + Agent Note + requirements status

Keep `vendor/README.md` staged if `vendor/aitopo/src/**` changes (pre-commit vendor manifest).

---

## Progress

| Chunk | Status |
|---|---|
| 0 Protocol locked/style/events | done |
| 1 InteractionHost helpers | done |
| 2 Group stroke paint | done |
| 3 Move / membership / lock | done |
| 4 External drop | done |
| 5 Marquee | done |
| 6 PatchHistory | done |
| 7 Demo + README + note | done |

---

## Follow-ups (not this plan)

- AT-E7 CreateEdge (orchestrator F2).
- Orchestrator F1: map `unit.locked` → `GraphNode.locked` (today lives under `data.locked`); wire interactions + PatchHistory in plugin host.
- Emit `alarmChanged` (Phase 1 gap) — orthogonal.
- Promote dual-face Agent Note from `proposed/` → `implemented/` if still pending.
