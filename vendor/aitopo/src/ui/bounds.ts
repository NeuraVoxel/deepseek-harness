/**
 * View helpers: bounds and hit-testing derived from scene elements.
 */

import { distanceToPolyline, hitRect, type Point, type Rect } from '../geom.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../protocol/types.ts'

const DEFAULT_W = 160
const DEFAULT_H = 48

/**
 * World bounds for a node (defaults when x/y/w/h missing).
 * @param node - graph node.
 */
export function nodeBounds(node: GraphNode): Rect {
  return {
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.w ?? DEFAULT_W,
    height: node.h ?? DEFAULT_H,
  }
}

/**
 * World bounds for a group band.
 * @param group - graph group.
 */
export function groupBounds(group: GraphGroup): Rect {
  return {
    x: group.x ?? 0,
    y: group.y ?? 0,
    width: group.w ?? DEFAULT_W,
    height: group.h ?? DEFAULT_H + 28,
  }
}

/**
 * Edge endpoint anchors and route points (twaver Link orthogonal/flexional ideas).
 * Prefer left↔right when boxes sit side-by-side (Model → Tools fan-out), then
 * top↔bottom for stacked bands (Join → next Step).
 * @param from - source node.
 * @param to - target node.
 */
export function edgeAnchors(from: GraphNode, to: GraphNode): {
  from: Point
  to: Point
  bounds: Rect
  orientation: 'horizontal' | 'vertical'
  /** Polyline points including endpoints (orthogonal.H.V / V.H style). */
  points: readonly Point[]
} {
  const a = nodeBounds(from)
  const b = nodeBounds(to)
  const acx = a.x + a.width / 2
  const acy = a.y + a.height / 2
  const bcx = b.x + b.width / 2
  const bcy = b.y + b.height / 2
  const aRight = a.x + a.width
  const aBottom = a.y + a.height
  const bRight = b.x + b.width
  const bBottom = b.y + b.height

  let fromPt: Point
  let toPt: Point
  let orientation: 'horizontal' | 'vertical'
  let points: Point[]

  // Right-side fan-out (Model → Tools) before vertical bands; vertical
  // before leftward (Join → next Step which sits below-left).
  if (b.x >= aRight - 1) {
    orientation = 'horizontal'
    fromPt = { x: aRight, y: acy }
    toPt = { x: b.x, y: bcy }
    points = orthogonalHV(fromPt, toPt)
  } else if (b.y >= aBottom - 1) {
    orientation = 'vertical'
    fromPt = { x: acx, y: aBottom }
    toPt = { x: bcx, y: b.y }
    points = orthogonalVH(fromPt, toPt)
  } else if (a.y >= bBottom - 1) {
    orientation = 'vertical'
    fromPt = { x: acx, y: a.y }
    toPt = { x: bcx, y: bBottom }
    points = orthogonalVH(fromPt, toPt)
  } else if (a.x >= bRight - 1) {
    orientation = 'horizontal'
    fromPt = { x: a.x, y: acy }
    toPt = { x: bRight, y: bcy }
    points = orthogonalHV(fromPt, toPt)
  } else {
    const dx = bcx - acx
    const dy = bcy - acy
    if (Math.abs(dx) >= Math.abs(dy)) {
      orientation = 'horizontal'
      if (dx >= 0) {
        fromPt = { x: aRight, y: acy }
        toPt = { x: b.x, y: bcy }
      } else {
        fromPt = { x: a.x, y: acy }
        toPt = { x: bRight, y: bcy }
      }
      points = orthogonalHV(fromPt, toPt)
    } else {
      orientation = 'vertical'
      if (dy >= 0) {
        fromPt = { x: acx, y: aBottom }
        toPt = { x: bcx, y: b.y }
      } else {
        fromPt = { x: acx, y: a.y }
        toPt = { x: bcx, y: bBottom }
      }
      points = orthogonalVH(fromPt, toPt)
    }
  }

  let bounds: Rect | undefined
  for (const point of points) {
    bounds = unionPoint(bounds, point)
  }
  return {
    from: fromPt,
    to: toPt,
    bounds: bounds ?? { x: fromPt.x, y: fromPt.y, width: 1, height: 1 },
    orientation,
    points,
  }
}

/** Horizontal-then-vertical orthognal: leave X, travel Y, enter X (H.V). */
function orthogonalHV(from: Point, to: Point): Point[] {
  if (Math.abs(from.y - to.y) < 0.5) return [from, to]
  const midX = (from.x + to.x) / 2
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to]
}

/** Vertical-then-horizontal orthogonal: leave Y, travel X, enter Y (V.H). */
function orthogonalVH(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) < 0.5) return [from, to]
  const midY = (from.y + to.y) / 2
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to]
}

function unionPoint(bounds: Rect | undefined, point: Point): Rect {
  if (bounds === undefined) return { x: point.x, y: point.y, width: 1, height: 1 }
  const x = Math.min(bounds.x, point.x)
  const y = Math.min(bounds.y, point.y)
  const right = Math.max(bounds.x + bounds.width, point.x)
  const bottom = Math.max(bounds.y + bounds.height, point.y)
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}


/**
 * Hit-test nodes top-most first.
 * @param point - world point.
 * @param nodes - nodes in paint order (later = top).
 * @param pad - hit padding.
 */
export function hitTestNodes(
  point: Point,
  nodes: readonly GraphNode[],
  pad = 0,
): GraphNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]!
    if (hitRect(point, nodeBounds(node), pad)) return node
  }
  return undefined
}

/**
 * Hit-test groups: among groups containing the point, prefer smallest area;
 * equal area keeps the topmost (later in paint order).
 * @param point - world point.
 * @param groups - groups in paint order (later = top).
 * @param pad - hit padding.
 * @returns winning group, or undefined.
 */
export function hitTestGroups(
  point: Point,
  groups: readonly GraphGroup[],
  pad = 0,
): GraphGroup | undefined {
  let best: GraphGroup | undefined
  let bestArea = Infinity
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i]!
    const bounds = groupBounds(group)
    if (!hitRect(point, bounds, pad)) continue
    const area = bounds.width * bounds.height
    if (best === undefined || area < bestArea) {
      best = group
      bestArea = area
    }
  }
  return best
}

/**
 * Hit-test edges by distance to the same orthogonal polyline used for paint.
 * Closest edge within tolerance wins; nodes must be resolved separately first.
 * @param point - world point.
 * @param edges - candidate edges.
 * @param nodeById - node lookup for endpoints.
 * @param tolerance - max distance in world units.
 */
export function hitTestEdges(
  point: Point,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<string, GraphNode>,
  tolerance: number,
): GraphEdge | undefined {
  let best: GraphEdge | undefined
  let bestDist = tolerance
  for (const edge of edges) {
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (from === undefined || to === undefined) continue
    const anchors = edgeAnchors(from, to)
    if (!hitRect(point, anchors.bounds, tolerance)) continue
    const dist = distanceToPolyline(point, anchors.points)
    if (dist <= bestDist) {
      bestDist = dist
      best = edge
    }
  }
  return best
}

export { DEFAULT_H, DEFAULT_W }

/** @param edge - edge whose id is returned. */
export function edgeId(edge: GraphEdge): string {
  return edge.id
}
