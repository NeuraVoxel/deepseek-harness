/**
 * Build an AITopo GraphDocument from a hand-authored skeleton + status overlay.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { FlowNodeStatus } from '../derive-flow.ts'
import { alarmsFromStatus } from '../aitopo/alarms-from-status.ts'

/** One skeleton node before live status is applied. */
export interface SkeletonNode {
  readonly id: string
  readonly label: string
  readonly type?: string
  readonly x: number
  readonly y: number
  readonly w?: number
  readonly h?: number
  readonly detail?: string
  readonly fill?: string
  readonly shape?: 'circle'
}

/** Directed skeleton edge. */
export interface SkeletonEdge {
  readonly from: string
  readonly to: string
  readonly kind?: 'flow' | 'data'
  readonly label?: string
}

/** Optional band around member node ids. */
export interface SkeletonGroup {
  readonly id: string
  readonly label: string
  readonly memberIds: readonly string[]
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Hand-authored dimension skeleton. */
export interface SkeletonGraph {
  readonly title: string
  readonly nodes: readonly SkeletonNode[]
  readonly edges: readonly SkeletonEdge[]
  readonly groups?: readonly SkeletonGroup[]
}

/**
 * Apply per-node status and emit a GraphDocument.
 * @param skeleton - static graph.
 * @param statusById - live overlay (missing ids stay pending).
 */
export function skeletonToDocument(
  skeleton: SkeletonGraph,
  statusById: ReadonlyMap<string, FlowNodeStatus> = new Map(),
): GraphDocument {
  const nodes: GraphNode[] = skeleton.nodes.map(node => {
    const status = statusById.get(node.id) ?? 'pending'
    const radius = node.shape === 'circle' ? Math.min(node.w ?? 56, node.h ?? 56) / 2 : undefined
    const w = node.w ?? 120
    const h = node.h ?? 44
    const alarms = alarmsFromStatus(status, node.id, node.detail)
    const circle = node.shape === 'circle' && radius !== undefined
    return {
      id: node.id,
      type: node.type ?? 'stage',
      label: node.label,
      status,
      x: circle ? node.x - radius : node.x,
      y: circle ? node.y - radius : node.y,
      w: circle ? radius * 2 : w,
      h: circle ? radius * 2 : h,
      ...(alarms === undefined ? {} : { alarms }),
      data: {
        meta: node.detail ?? node.type ?? 'stage',
        ...(node.fill === undefined ? {} : { fill: node.fill }),
        ...(node.shape === undefined ? {} : { shape: node.shape }),
      },
    }
  })

  const edges: GraphEdge[] = skeleton.edges.map(edge => {
    const isData = edge.kind === 'data'
    return {
      id: `${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      kind: edge.kind ?? 'flow',
      data: {
        stroke: isData ? '#3a4846' : '#5a6478',
        strokeHover: isData ? '#5eead4' : '#3b82f6',
        lineWidth: isData ? 1.2 : 1.25,
        ...(edge.label === undefined ? {} : { label: edge.label }),
      },
    }
  })

  const groups: GraphGroup[] | undefined = skeleton.groups?.map(group => ({
    id: group.id,
    label: group.label,
    memberIds: group.memberIds,
    x: group.x,
    y: group.y,
    w: group.w,
    h: group.h,
  }))

  return {
    version: 1,
    meta: { kind: 'flow', title: skeleton.title },
    nodes,
    edges,
    ...(groups === undefined ? {} : { groups }),
  }
}
