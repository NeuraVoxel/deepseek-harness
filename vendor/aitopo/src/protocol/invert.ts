/**
 * Compute inverse GraphPatch ops from a pre-apply document snapshot.
 *
 * SubNetwork navigation (`enterSubNetwork` / `exitSubNetwork`) and `setSelection`
 * return an empty array: `applyPatch` leaves the document unchanged for those ops
 * (Network owns selection and stack navigation). Hosts that need them in history
 * should filter or extend outside this helper.
 */

import { applyPatch, type GraphPatch, type GraphPatchOp } from './patch.ts'
import type { Alarm, GraphDocument, GraphEdge, GraphGroup, GraphNode } from './types.ts'

/**
 * Inverse of one op against the document state before that op runs.
 * @param beforeDoc - document prior to `op`.
 * @param op - forward op.
 * @returns one op, several ops (e.g. removeNode restores cascaded edges), or `[]` to skip.
 */
export function invertOp(beforeDoc: GraphDocument, op: GraphPatchOp): GraphPatchOp | GraphPatchOp[] {
  switch (op.op) {
    case 'addNode':
      return { op: 'removeNode', id: op.node.id }
    case 'removeNode': {
      const node = beforeDoc.nodes.find(n => n.id === op.id)
      if (node === undefined) throw new Error(`invert removeNode: missing id ${op.id}`)
      const lostEdges = beforeDoc.edges.filter(e => e.from === op.id || e.to === op.id)
      return [
        { op: 'addNode', node: cloneNode(node) },
        ...lostEdges.map(edge => ({ op: 'addEdge' as const, edge: cloneEdge(edge) })),
      ]
    }
    case 'updateNode': {
      const node = beforeDoc.nodes.find(n => n.id === op.id)
      if (node === undefined) throw new Error(`invert updateNode: missing id ${op.id}`)
      return { op: 'updateNode', id: op.id, patch: invertNodePatch(node, op.patch) }
    }
    case 'addEdge':
      return { op: 'removeEdge', id: op.edge.id }
    case 'removeEdge': {
      const edge = beforeDoc.edges.find(e => e.id === op.id)
      if (edge === undefined) throw new Error(`invert removeEdge: missing id ${op.id}`)
      return { op: 'addEdge', edge: cloneEdge(edge) }
    }
    case 'updateEdge': {
      const edge = beforeDoc.edges.find(e => e.id === op.id)
      if (edge === undefined) throw new Error(`invert updateEdge: missing id ${op.id}`)
      return { op: 'updateEdge', id: op.id, patch: invertEdgePatch(edge, op.patch) }
    }
    case 'addGroup':
      return { op: 'removeGroup', id: op.group.id }
    case 'removeGroup': {
      const group = (beforeDoc.groups ?? []).find(g => g.id === op.id)
      if (group === undefined) throw new Error(`invert removeGroup: missing id ${op.id}`)
      return { op: 'addGroup', group: cloneGroup(group) }
    }
    case 'updateGroup': {
      const group = (beforeDoc.groups ?? []).find(g => g.id === op.id)
      if (group === undefined) throw new Error(`invert updateGroup: missing id ${op.id}`)
      return { op: 'updateGroup', id: op.id, patch: invertGroupPatch(group, op.patch) }
    }
    case 'setAlarms': {
      if (op.target === 'node') {
        const node = beforeDoc.nodes.find(n => n.id === op.elementId)
        if (node === undefined) throw new Error(`invert setAlarms: missing node ${op.elementId}`)
        return {
          op: 'setAlarms',
          elementId: op.elementId,
          target: 'node',
          alarms: cloneAlarms(node.alarms),
        }
      }
      const edge = beforeDoc.edges.find(e => e.id === op.elementId)
      if (edge === undefined) throw new Error(`invert setAlarms: missing edge ${op.elementId}`)
      return {
        op: 'setAlarms',
        elementId: op.elementId,
        target: 'edge',
        alarms: cloneAlarms(edge.alarms),
      }
    }
    case 'setViewport': {
      if (beforeDoc.viewport === undefined) return []
      return { op: 'setViewport', viewport: { ...beforeDoc.viewport } }
    }
    case 'setSelection':
    case 'enterSubNetwork':
    case 'exitSubNetwork':
      return []
    default: {
      const _exhaustive: never = op
      throw new Error(`unhandled invert op: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/**
 * Inverse ops for a whole patch (reverse order, each against its pre-op doc).
 * @param beforeDoc - document prior to the patch.
 * @param patch - forward patch.
 * @returns inverse ops (may be empty when every forward op is skipped).
 */
export function invertPatch(beforeDoc: GraphDocument, patch: GraphPatch): GraphPatchOp[] {
  let doc = beforeDoc
  const perOp: GraphPatchOp[][] = []
  for (const op of patch.ops) {
    perOp.push(asOpList(invertOp(doc, op)))
    doc = applyPatch(doc, { ops: [op] })
  }
  const out: GraphPatchOp[] = []
  for (let i = perOp.length - 1; i >= 0; i--) {
    out.push(...perOp[i]!)
  }
  return out
}

function asOpList(inv: GraphPatchOp | GraphPatchOp[]): GraphPatchOp[] {
  return Array.isArray(inv) ? inv : [inv]
}

type UpdateNodePatch = Extract<GraphPatchOp, { op: 'updateNode' }>['patch']
type UpdateEdgePatch = Extract<GraphPatchOp, { op: 'updateEdge' }>['patch']
type UpdateGroupPatch = Extract<GraphPatchOp, { op: 'updateGroup' }>['patch']

function invertNodePatch(node: GraphNode, patch: UpdateNodePatch): UpdateNodePatch {
  const inv: UpdateNodePatch = {}
  if (patch.type !== undefined) inv.type = node.type
  if (patch.label !== undefined) inv.label = node.label
  if (patch.status !== undefined && node.status !== undefined) inv.status = node.status
  if (patch.x !== undefined && node.x !== undefined) inv.x = node.x
  if (patch.y !== undefined && node.y !== undefined) inv.y = node.y
  if (patch.w !== undefined && node.w !== undefined) inv.w = node.w
  if (patch.h !== undefined && node.h !== undefined) inv.h = node.h
  if (patch.parentId !== undefined && node.parentId !== undefined) inv.parentId = node.parentId
  if (patch.groupId !== undefined) inv.groupId = node.groupId ?? null
  if (patch.networkId !== undefined && node.networkId !== undefined) inv.networkId = node.networkId
  if (patch.locked !== undefined && node.locked !== undefined) inv.locked = node.locked
  if (patch.alarms !== undefined) inv.alarms = cloneAlarms(node.alarms)
  if (patch.data !== undefined && node.data !== undefined) inv.data = { ...node.data }
  return inv
}

function invertEdgePatch(edge: GraphEdge, patch: UpdateEdgePatch): UpdateEdgePatch {
  const inv: UpdateEdgePatch = {}
  if (patch.from !== undefined) inv.from = edge.from
  if (patch.to !== undefined) inv.to = edge.to
  if (patch.kind !== undefined && edge.kind !== undefined) inv.kind = edge.kind
  if (patch.alarms !== undefined) inv.alarms = cloneAlarms(edge.alarms)
  if (patch.data !== undefined && edge.data !== undefined) inv.data = { ...edge.data }
  return inv
}

function invertGroupPatch(group: GraphGroup, patch: UpdateGroupPatch): UpdateGroupPatch {
  const inv: UpdateGroupPatch = {}
  if (patch.label !== undefined) inv.label = group.label
  if (patch.memberIds !== undefined) inv.memberIds = [...group.memberIds]
  if (patch.x !== undefined && group.x !== undefined) inv.x = group.x
  if (patch.y !== undefined && group.y !== undefined) inv.y = group.y
  if (patch.w !== undefined && group.w !== undefined) inv.w = group.w
  if (patch.h !== undefined && group.h !== undefined) inv.h = group.h
  if (patch.style !== undefined && group.style !== undefined) {
    inv.style = {
      ...(group.style.stroke !== undefined ? { stroke: group.style.stroke } : {}),
      ...(group.style.strokeWidth !== undefined ? { strokeWidth: group.style.strokeWidth } : {}),
      ...(group.style.strokeDash !== undefined ? { strokeDash: [...group.style.strokeDash] } : {}),
      ...(group.style.fill !== undefined ? { fill: group.style.fill } : {}),
    }
  }
  return inv
}

type PatchNode = Extract<GraphPatchOp, { op: 'addNode' }>['node']
type PatchEdge = Extract<GraphPatchOp, { op: 'addEdge' }>['edge']
type PatchGroup = Extract<GraphPatchOp, { op: 'addGroup' }>['group']

function cloneAlarms(alarms: readonly Alarm[] | undefined): NonNullable<PatchNode['alarms']> {
  if (alarms === undefined) return []
  return alarms.map(a => (a.ts === undefined
    ? { id: a.id, level: a.level, message: a.message }
    : { id: a.id, level: a.level, message: a.message, ts: a.ts }))
}

function cloneNode(node: GraphNode): PatchNode {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    ...(node.status !== undefined ? { status: node.status } : {}),
    ...(node.x !== undefined ? { x: node.x } : {}),
    ...(node.y !== undefined ? { y: node.y } : {}),
    ...(node.w !== undefined ? { w: node.w } : {}),
    ...(node.h !== undefined ? { h: node.h } : {}),
    ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
    ...(node.groupId !== undefined ? { groupId: node.groupId } : {}),
    ...(node.networkId !== undefined ? { networkId: node.networkId } : {}),
    ...(node.locked !== undefined ? { locked: node.locked } : {}),
    ...(node.alarms !== undefined ? { alarms: cloneAlarms(node.alarms) } : {}),
    ...(node.data !== undefined ? { data: { ...node.data } } : {}),
  }
}

function cloneEdge(edge: GraphEdge): PatchEdge {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    ...(edge.kind !== undefined ? { kind: edge.kind } : {}),
    ...(edge.alarms !== undefined ? { alarms: cloneAlarms(edge.alarms) } : {}),
    ...(edge.data !== undefined ? { data: { ...edge.data } } : {}),
  }
}

function cloneGroup(group: GraphGroup): PatchGroup {
  return {
    id: group.id,
    label: group.label,
    memberIds: [...group.memberIds],
    ...(group.x !== undefined ? { x: group.x } : {}),
    ...(group.y !== undefined ? { y: group.y } : {}),
    ...(group.w !== undefined ? { w: group.w } : {}),
    ...(group.h !== undefined ? { h: group.h } : {}),
    ...(group.style !== undefined
      ? {
          style: {
            ...(group.style.stroke !== undefined ? { stroke: group.style.stroke } : {}),
            ...(group.style.strokeWidth !== undefined ? { strokeWidth: group.style.strokeWidth } : {}),
            ...(group.style.strokeDash !== undefined ? { strokeDash: [...group.style.strokeDash] } : {}),
            ...(group.style.fill !== undefined ? { fill: group.style.fill } : {}),
          },
        }
      : {}),
  }
}
