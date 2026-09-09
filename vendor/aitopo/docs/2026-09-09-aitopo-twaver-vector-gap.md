# AITopo ↔ twaver.vector gap backlog

**Status:** living checklist (2026-09-09)
**Package:** `@neuravoxel/aitopo`
**Design reference (read-only):** `vendor/SDK2D/twaver/vector/`
**Base design:** [2026-09-07-aitopo-design.md](./2026-09-07-aitopo-design.md)
**Editor requirements:** [2026-09-08-aitopo-editor-requirements.md](./2026-09-08-aitopo-editor-requirements.md)

## Summary

AITopo borrows **ideas** from `twaver.vector`; it is a clean-room TypeScript rewrite. This file maps each `vendor/SDK2D/twaver/vector/**/*.js` module to an AITopo status so follow-up work stays product-driven, not feature-parity-driven.

Do not import SDK2D, copy identifiers (`DataBox`, `ElementUI`, `DefaultInteraction`, …), or treat this backlog as a commitment to port every module.

## Status legend

| Tag | Meaning |
|---|---|
| `done` | Equivalent capability exists under AITopo names |
| `gap` | In design / README as owed work, not finished |
| `later` | Reasonable later; not blocking current milestones |
| `wont` | Explicit non-goal for the current product scope |

## Network / zoom / overview

| Reference path | Idea | Status | AITopo / notes |
|---|---|---|---|
| `Network.js` | Dual canvas, invalidate/validate, interaction stack, movable gate | `done` (subset) | `Network` + dirty loop + interactions; no `LayerBox` / `setEdit*` names |
| `PhysicalZoomManager.js` | Physical zoom | `done` | `Viewport` |
| `BaseZoomManager.js` | Zoom manager base | `wont` | Folded into `Viewport` |
| `LogicalZoomManager.js` | Logical zoom (font/stroke independent of camera) | `later` | Partial: world-space labels + screen-constant strokes |
| `MixedZoomManager.js` | Mixed zoom policy | `wont` | No product need |
| `Overview.js` | Overview widget | `wont` | Design / README non-goal |
| `OverviewInteraction.js` | Overview pointer wiring | `wont` | |
| `OverviewTouchInteraction.js` | Overview touch | `wont` | |
| `OverviewMSTouchInteraction.js` | Overview MS touch | `wont` | |
| `CanvasUtil.js` | Canvas helpers | `done` (internalized) | `geom` + `canvas2d` |
| `vector_default.js` | Default style table | `wont` | Protocol fields + renderer defaults |

## UI / attachments

| Reference path | Idea | Status | AITopo / notes |
|---|---|---|---|
| `ElementUI.js` | Validate bounds → paint | `gap` | Design names `NodeView` / `EdgeView` / `GroupView`; impl is `ui/bounds` + direct Canvas2D |
| `NodeUI.js` | Node body paint | `gap` | Same as above |
| `LinkUI.js` | Link / edge paint | `gap` | Orthogonal polylines + mid-edge label in renderer |
| `GroupUI.js` | Group band + outline styles | `done` (styles) | `GraphGroup.style`; no separate GroupUI class |
| `Attachment.js` | Attachment base | `wont` | No attachment hierarchy |
| `BasicAttachment.js` | Shared attachment paint | `wont` | |
| `AlarmAttachment.js` | Alarm badge | `gap` | Inline badge paint; protocol has `alarmChanged` but Network does not emit it |
| `LabelAttachment.js` | Primary label | `done` (simplified) | Drawn inside `drawNode` |
| `Label2Attachment.js` | Secondary label | `later` | |
| `IconsAttachment.js` | Icon strip | `later` | Host/`data` extension if needed |
| `LinkHandlerAttachment.js` | On-link click handle | `later` | Delete path covered by `DeleteEdgeInteraction` |
| `EditAttachment.js` | Resize/rotate handles | `later` | With edit interaction |
| `HTMLNodeUI.js` | HTML overlay node | `wont` | |
| `HTMLLinkUI.js` | HTML overlay link | `wont` | |
| `HTMLLabelAttachment.js` | HTML label | `wont` | |
| `HTMLLabel2Attachment.js` | HTML secondary label | `wont` | |
| `HTMLAlarmAttachment.js` | HTML alarm | `wont` | |
| `ShapeNodeUI.js` | Shape / polyline node | `later` | |
| `ShapeLinkUI.js` | Shape link | `later` | |
| `RotatableNodeUI.js` | Rotatable node | `later` | |
| `GridUI.js` | Grid element UI | `wont` | |

## Interactions

| Reference path | Idea | Status | AITopo / notes |
|---|---|---|---|
| `interaction/BaseInteraction.js` | Attach / tearDown, overlay paint, point conversion | `done` | `Interaction.attach → disposer` + `InteractionHost` |
| `interaction/DefaultInteraction.js` | Live move of selected movable set | `done` | `MoveNodeInteraction` |
| same | Lazy move ghost outline | `later` | Live-only today |
| same | Rect select overlay | `done` | `MarqueeSelectInteraction` (replace-only on up) |
| same | Empty-space pan | `done` | `PanZoomInteraction` |
| same | Reparent while **P** held | `done` (behavior change) | Drop hit-test group on pointer-up; no chord key |
| `interaction/CreateLinkInteraction.js` | From/to rubber-band | `done` | `CreateEdgeInteraction` |
| `interaction/CreateElementInteraction.js` | Click-to-create element | `later` | Host adds via `externalDrop` + `addNode` |
| `interaction/CreateShapeNodeInteraction.js` | Draw shape node | `wont` unless product asks | |
| `interaction/CreateShapeLinkInteraction.js` | Draw shape link | `wont` unless product asks | |
| `interaction/EditInteraction.js` | Resize / rotate / link points | `later` | Explicitly out of Editor F1 |
| `interaction/MoveLinkInteraction.js` | Drag link control points | `later` | |
| `interaction/MagnifyInteraction.js` | Magnifier | `wont` | |
| `interaction/TouchInteraction.js` | Touch gestures | `later` | Desktop-first |
| `interaction/MSTouchInteraction.js` | MS pointer touch | `later` | |

## Related engine gaps (not a single vector file)

| Item | Status | Notes |
|---|---|---|
| Emit `alarmChanged` on `setAlarms` / alarm-bearing patches | `gap` | Event type exists; Network never emits |
| Marquee Shift-append selection | `later` | Replace-only today |
| Multi-level SubNetwork stack UI | `later` | Root ↔ one child only |
| Alarm propagation tree | `wont` (current phases) | Display + model only |
| WebGL `Renderer` | `later` | Interface reserved |
| React / `agent-observe` adapter | `gap` (plugin) | Outside `@neuravoxel/aitopo` |
| Orchestrator F1 host wiring | `gap` (plugin) | Engine Editor APIs ready |
| Extract View classes from renderer | `gap` | Align with design layout |

## Suggested next waves

### P0 — product hosts

- [ ] `plugins/agent-observe`: snapshot/flow → `GraphDocument` + mount `Network`
- [ ] `plugins/agent-orchestrator` F1: map `locked`, attach editor interactions, optional `PatchHistory`

### P1 — engine debt

- [ ] Emit `alarmChanged` on alarm mutations
- [ ] Marquee Shift-append if shell needs multi-select add
- [ ] Temporary highlight for drop-target group during move (DefaultInteraction `parentRect` idea)

### P2 — deeper edit

- [ ] Lazy move ghost on overlay
- [ ] Resize (and optional rotate) edit handles
- [ ] Move-link / link-handler equivalents

### Explicit non-goals

Overview, HTML node/link UI, Magnify, MixedZoom, GridUI, PropertyBox, GIS, DXF, copying or wrapping `vendor/SDK2D`.

## Maintenance

When a row changes status, update this file in the same PR as the code or host wiring. Keep `vendor/README.md` local-modification log only when `vendor/aitopo/src/**` changes.
