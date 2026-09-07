/**
 * View helpers: bounds and hit-testing derived from scene elements.
 */

import { hitRect, type Point, type Rect } from '../geom.ts'
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
 * Edge endpoint anchors. Prefers left/right when the target is mostly
 * horizontal of the source; otherwise bottom → top (fleet trees).
 * @param from - source node.
 * @param to - target node.
 */
export function edgeAnchors(from: GraphNode, to: GraphNode): {
  from: Point
  to: Point
  bounds: Rect
  orientation: 'horizontal' | 'vertical'
} {
  const a = nodeBounds(from)
  const b = nodeBounds(to)
  const acx = a.x + a.width / 2
  const acy = a.y + a.height / 2
  const bcx = b.x + b.width / 2
  const bcy = b.y + b.height / 2
  const dx = bcx - acx
  const dy = bcy - acy
  let fromPt: Point
  let toPt: Point
  let orientation: 'horizontal' | 'vertical'
  if (Math.abs(dx) >= Math.abs(dy)) {
    orientation = 'horizontal'
    if (dx >= 0) {
      fromPt = { x: a.x + a.width, y: acy }
      toPt = { x: b.x, y: bcy }
    } else {
      fromPt = { x: a.x, y: acy }
      toPt = { x: b.x + b.width, y: bcy }
    }
  } else {
    orientation = 'vertical'
    if (dy >= 0) {
      fromPt = { x: acx, y: a.y + a.height }
      toPt = { x: bcx, y: b.y }
    } else {
      fromPt = { x: acx, y: a.y }
      toPt = { x: bcx, y: b.y + b.height }
    }
  }
  const x = Math.min(fromPt.x, toPt.x)
  const y = Math.min(fromPt.y, toPt.y)
  const width = Math.max(1, Math.abs(toPt.x - fromPt.x))
  const height = Math.max(1, Math.abs(toPt.y - fromPt.y))
  return { from: fromPt, to: toPt, bounds: { x, y, width, height }, orientation }
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

export { DEFAULT_H, DEFAULT_W }

/** @param _edge - reserved for future edge hit geometry. */
export function edgeId(_edge: GraphEdge): string {
  return _edge.id
}
