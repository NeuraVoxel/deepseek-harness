/**
 * Adapt Agent Observe fleet snapshot + layout into an AITopo GraphDocument.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentObserveGroupMode, AgentObserveNode, AgentObserveSnapshot } from '../../types.ts'
import { layoutTopology, NODE_SIZE, type CanvasLayout } from '../layout.ts'

/** Inputs for {@link snapshotToDocument}. */
export interface SnapshotToDocumentOptions {
  readonly snapshot: AgentObserveSnapshot
  readonly groupMode: AgentObserveGroupMode
  readonly labels: { ungrouped: string; workspaceTitle: (id: string) => string }
  /** Highlight the open conversation Session. */
  readonly currentSessionId?: SessionId
  /**
   * Workspace ids in Harness Workspaces list order.
   * When `groupMode === 'workspace'`, groups lay out left-to-right in this order.
   */
  readonly workspaceOrder?: readonly string[]
}

/** Result of fleet → document adaptation. */
export interface FleetDocumentResult {
  readonly document: GraphDocument
  readonly layout: CanvasLayout
  /** True when teams mode has at least one `teamId` and nested networks. */
  readonly hasTeamNetworks: boolean
}

/**
 * Layout the snapshot and emit a GraphDocument (plain string ids).
 * @param options - snapshot, group mode, labels, current session.
 */
export function snapshotToDocument(options: SnapshotToDocumentOptions): FleetDocumentResult {
  const { snapshot, groupMode, labels, currentSessionId, workspaceOrder } = options
  const layout = layoutTopology(
    snapshot,
    groupMode,
    labels,
    workspaceOrder === undefined ? {} : { workspaceOrder },
  )
  const nodes: GraphNode[] = layout.nodes.map(node => {
    const id = node.id as string
    const current = currentSessionId !== undefined && node.id === currentSessionId
    const networkId = groupMode === 'teams' && node.teamId !== undefined
      ? `team:${node.teamId}`
      : undefined
    // AITopo paints running/idle/cold; archive reuses cold chrome (gray).
    const paintStatus = node.status === 'archived' ? 'cold' : node.status
    return {
      id,
      type: 'agent',
      label: node.title,
      status: paintStatus,
      x: node.x,
      y: node.y,
      w: NODE_SIZE.width,
      h: NODE_SIZE.height,
      groupId: node.groupKey,
      ...(networkId === undefined ? {} : { networkId }),
      data: {
        meta: [
          node.status,
          node.origin === 'subagent' ? 'sub' : undefined,
          current ? 'current' : undefined,
        ].filter(Boolean).join(' · '),
        ...(current ? { stroke: '#5b8def', current: true } : {}),
      },
    }
  })

  const edges: GraphEdge[] = snapshot.edges.map(edge => ({
    id: `${edge.kind}:${edge.from as string}:${edge.to as string}`,
    from: edge.from as string,
    to: edge.to as string,
    kind: edge.kind,
  }))

  const groups: GraphGroup[] = layout.groups.map(group => ({
    id: group.key,
    label: group.label,
    memberIds: layout.nodes.filter(n => n.groupKey === group.key).map(n => n.id as string),
    x: group.x,
    y: group.y,
    w: group.width,
    h: group.height,
  }))

  const networks = groupMode === 'teams' ? buildTeamNetworks(snapshot, labels) : undefined
  const hasTeamNetworks = networks !== undefined && Object.keys(networks).length > 0

  return {
    layout,
    hasTeamNetworks,
    document: {
      version: 1,
      meta: { kind: 'topology', title: 'agent-observe-fleet' },
      nodes,
      edges,
      groups,
      ...(hasTeamNetworks ? { networks } : {}),
    },
  }
}

function buildTeamNetworks(
  snapshot: AgentObserveSnapshot,
  labels: SnapshotToDocumentOptions['labels'],
): Record<string, GraphDocument> | undefined {
  const byTeam = new Map<string, AgentObserveNode[]>()
  for (const node of snapshot.nodes) {
    if (node.teamId === undefined) continue
    const list = byTeam.get(node.teamId)
    if (list === undefined) byTeam.set(node.teamId, [node])
    else list.push(node)
  }
  if (byTeam.size === 0) return undefined

  const networks: Record<string, GraphDocument> = {}
  for (const [teamId, members] of byTeam) {
    const childSnapshot: AgentObserveSnapshot = {
      nodes: members,
      edges: snapshot.edges.filter(edge =>
        members.some(m => m.id === edge.from) && members.some(m => m.id === edge.to)),
      updatedAt: snapshot.updatedAt,
    }
    const child = snapshotToDocument({
      snapshot: childSnapshot,
      groupMode: 'workspace',
      labels,
    })
    networks[`team:${teamId}`] = {
      ...child.document,
      meta: { kind: 'topology', title: teamId },
    }
  }
  return networks
}
