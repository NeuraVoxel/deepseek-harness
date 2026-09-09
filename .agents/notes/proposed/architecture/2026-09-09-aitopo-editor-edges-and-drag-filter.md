# Agent Note: AITopo Editor edges + drag paint filter

Status: proposed

English | [中文](2026-09-09-aitopo-editor-edges-and-drag-filter.zh.md)

## Problem

The Editor demo shipped move/drop/marquee without sample edges or create/delete gestures (AT-E7). Hosts also need an optional way to hide non-movers while dragging, with the default remaining full-scene paint.

A follow-up bug: with `hideOthersWhileDragging: false` (default), live drag still appeared to hide siblings because `Canvas2DRenderer.beginFrame` cleared the **entire** root canvas then clipped to a small dirty rect from `previewNodePosition`, wiping every pixel outside that rect.

## Proposal

1. Ship `CreateEdgeInteraction` (Alt+drag node→node, or `requireAlt: false` exclusive link mode) with overlay rubber-band; `Network.commitEdgeCreate` applies `addEdge` and emits `edgeCreated`.
2. Ship `DeleteEdgeInteraction` (Delete/Backspace on selected edges) plus `commitEdgeRemove` → `edgeRemoved`.
3. Extend `editor.json` with labeled `data` / `control` edges so live move visibly updates wires.
4. `MoveNodeInteraction({ hideOthersWhileDragging })` defaults to **false** (paint all). When true, `setDragPaintFilter` keeps movers + incident edges only for the gesture duration; validate forces full-frame clear while the filter is set.
5. Live `previewNodePosition` uses `dirty.markAll()` so incident edges and siblings stay painted when the filter is off.
6. `beginFrame` clears only dirty screen rects on partial invalidate (never full-clear-then-clip).
7. Demo toggles: Link mode, edge Kind, Hide others, Delete edge.

Related: [Editor interactions](2026-09-09-aitopo-editor-interactions.md).

## Alternatives considered

- **Always paint movers-only during drag.** Rejected: product default is full scene (`所有都绘制`); hide-others is opt-in.
- **Engine auto-delete nodes on Delete.** Rejected: this change scopes keyboard delete to edges only.
- **Two-click create without drag.** Deferred: Alt-drag matches the twaver CreateLink rubber-band idea and composes with Move via Alt.
- **Keep full-canvas clear + rely only on markAll during preview.** Insufficient: any other partial dirty path would still wipe the scene; clear-only-dirty is the durable fix.

## Acceptance criteria

- Unit tests cover create/delete edge, duplicate/self skip, hideOthers filter set/clear, Alt skip on Move.
- Editor fixture parses with edges; demo documents Alt-link and Hide others OFF by default.
- Drag with hide-others OFF keeps non-mover nodes/groups visible; ON clears them for the gesture.
- No `twaver` / `SDK2D` imports under `vendor/aitopo/src`.
