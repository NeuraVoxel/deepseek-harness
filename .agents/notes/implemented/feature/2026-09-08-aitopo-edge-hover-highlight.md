# Agent Note: AITopo GraphEdge hover highlight

Status: implemented

English | [中文](2026-09-08-aitopo-edge-hover-highlight.zh.md)

## Problem

AITopo painted and could select edges, and `hoverChanged` already carried a generic element id, but `hitTestScreen` only resolved nodes. Operators could not hover a `GraphEdge` to highlight the wire.

## Decision

In `vendor/aitopo`:

- Add `distanceToSegment` / `distanceToPolyline` and `hitTestEdges` against the same `edgeAnchors()` polyline used for paint.
- `hitTestScreen` returns `{ id, kind: 'node' | 'edge' }` — nodes first, then edges at tolerance `4 / zoom`.
- `EdgePaintView.hovered` uses the same thicker stroke as selection; existing `hoverChanged` carries the edge id.
- Edge pointer-down selects the edge but does not call `activateNode`.
- When `scene.hover` is a **node** id, incident edges with `kind === 'data'` also paint as hovered so payload routes light up without keeping bright idle data strokes.
- Highlighted (hovered / selected) edges paint on the **overlay** canvas so node fills on the root layer cannot cover them.

`plugins/agent-canvas` sets muted idle `data.stroke` (`#3a4846`) and teal `strokeHover` (`#5eead4`) for data edges; flow edges keep gray / blue.

Logged under `vendor/README.md` local modification #20.

## Alternatives considered

- **New `edgeHovered` event.** Rejected: `hoverChanged.hoverId` already covers any element id.
- **Pixel-perfect canvas picking.** Rejected for this pass: polyline distance matches drawn geometry and stays cheap.

## Consequences

- Pan still starts only on empty space (edge hits block pan, same as nodes).
- Required verification: `pnpm --filter @neuravoxel/aitopo test` (or `cd vendor/aitopo && pnpm test`).
