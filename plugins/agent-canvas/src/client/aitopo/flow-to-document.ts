/**
 * Adapt Agent process flow snapshot + layout into an AITopo GraphDocument.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { AgentFlowSnapshot } from '../derive-flow.ts'
import { layoutAgentFlow, type FlowLayout } from '../layout-flow.ts'
import { alarmsFromStatus } from './alarms-from-status.ts'

/** Result of flow → document adaptation. */
export interface FlowDocumentResult {
  readonly document: GraphDocument
  readonly layout: FlowLayout
}

/** Optional localized labels for join / parallel chrome. */
export interface FlowToDocumentLabels {
  readonly join?: string
  /** Band suffix when tools stack; e.g. "parallel". */
  readonly parallel?: string
}

/**
 * Layout the flow and emit a GraphDocument.
 * @param snapshot - latest-turn process topology.
 * @param labels - optional localized join / parallel strings.
 */
export function flowToDocument(
  snapshot: AgentFlowSnapshot,
  labels: FlowToDocumentLabels = {},
): FlowDocumentResult {
  const layout = layoutAgentFlow(snapshot)
  const nodes: GraphNode[] = layout.nodes.map(node => {
    const isTool = node.kind === 'tool'
    const radius = node.radius ?? 28
    const alarms = alarmsFromStatus(node.status, node.id, node.detail)
    const x = isTool ? node.x - radius : node.x
    const y = isTool ? node.y - radius : node.y
    const w = isTool ? radius * 2 : node.width
    const h = isTool ? radius * 2 : node.height
    const label = node.kind === 'join' && labels.join !== undefined
      ? labels.join
      : node.label
    return {
      id: node.id,
      type: node.kind === 'tool' ? 'tool' : node.kind,
      label,
      status: node.status,
      x,
      y,
      w,
      h,
      ...(alarms === undefined ? {} : { alarms }),
      data: {
        meta: node.detail ?? node.kind,
        inputText: node.inputText,
        outputText: node.outputText,
        ...(isTool ? { shape: 'circle' } : {}),
        ...flowKindPaint(node.kind),
      },
    }
  })

  const edges: GraphEdge[] = layout.edges.map(edge => ({
    id: `${edge.from}->${edge.to}`,
    from: edge.from,
    to: edge.to,
    kind: 'flow',
  }))

  const groups: GraphGroup[] = layout.groups.map(group => {
    let label = group.label
    if (group.parallelTools === true && labels.parallel !== undefined) {
      const base = group.step !== undefined ? `Step ${group.step}` : group.label.replace(/ · .*$/, '')
      label = `${base} · ${labels.parallel}`
    }
    return {
      id: group.key,
      label,
      memberIds: layout.nodes
        .filter(n => bandKey(n) === group.key)
        .map(n => n.id),
      x: group.x,
      y: group.y,
      w: group.width,
      h: group.height,
    }
  })

  return {
    layout,
    document: {
      version: 1,
      meta: { kind: 'flow', title: 'agent-canvas-flow' },
      nodes,
      edges,
      groups,
    },
  }
}

function bandKey(node: { step?: number; kind: string }): string {
  if (node.kind === 'turn-end' || node.kind === 'client-render') return 'epilogue'
  if (node.step === undefined) return 'prelude'
  return `step:${node.step}`
}

function flowKindPaint(kind: string): { fill?: string } {
  switch (kind) {
    case 'client-input': return { fill: '#0f3d38' }
    case 'host-admit': return { fill: '#152a48' }
    case 'step': return { fill: '#2a1f4a' }
    case 'model': return { fill: '#3a2a10' }
    case 'tool': return { fill: '#3a1530' }
    case 'join': return { fill: '#1e293b' }
    case 'turn-end': return { fill: '#1a1d24' }
    case 'client-render': return { fill: '#143528' }
    default: return {}
  }
}
