/**
 * Immutable GraphPatch application on GraphDocument.
 */

import { graphPatchSchema, type GraphPatch, type GraphPatchOp } from './schema.ts'
import type { Alarm, GraphDocument, GraphEdge, GraphGroup, GraphNode } from './types.ts'

export type { GraphPatch, GraphPatchOp }

/**
 * Apply a structural patch to a document; returns a new document.
 * @param doc - current document (not mutated).
 * @param patch - ops list (validated).
 * @returns next document.
 * @throws on invalid patch or missing referents.
 */
export function applyPatch(doc: GraphDocument, patch: unknown): GraphDocument {
  const parsed = graphPatchSchema.safeParse(patch)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.') || '(root)'
    throw new Error(`GraphPatch parse failed at ${path}: ${issue?.message ?? 'invalid patch'}`)
  }
  let next = structuredClone(doc)
  for (const op of parsed.data.ops) {
    next = applyOp(next, op)
  }
  return next
}

function applyOp(doc: GraphDocument, op: GraphPatchOp): GraphDocument {
  switch (op.op) {
    case 'addNode': {
      if (doc.nodes.some(n => n.id === op.node.id)) {
        throw new Error(`addNode: duplicate id ${op.node.id}`)
      }
      return { ...doc, nodes: [...doc.nodes, asNode(op.node)] }
    }
    case 'updateNode': {
      const index = doc.nodes.findIndex(n => n.id === op.id)
      if (index < 0) throw new Error(`updateNode: missing id ${op.id}`)
      const current = doc.nodes[index]!
      const nodes = doc.nodes.slice()
      nodes[index] = mergeNode(current, op.patch)
      return { ...doc, nodes }
    }
    case 'removeNode': {
      if (!doc.nodes.some(n => n.id === op.id)) {
        throw new Error(`removeNode: missing id ${op.id}`)
      }
      return {
        ...doc,
        nodes: doc.nodes.filter(n => n.id !== op.id),
        edges: doc.edges.filter(e => e.from !== op.id && e.to !== op.id),
      }
    }
    case 'addEdge': {
      if (doc.edges.some(e => e.id === op.edge.id)) {
        throw new Error(`addEdge: duplicate id ${op.edge.id}`)
      }
      return { ...doc, edges: [...doc.edges, asEdge(op.edge)] }
    }
    case 'updateEdge': {
      const index = doc.edges.findIndex(e => e.id === op.id)
      if (index < 0) throw new Error(`updateEdge: missing id ${op.id}`)
      const current = doc.edges[index]!
      const edges = doc.edges.slice()
      edges[index] = mergeEdge(current, op.patch)
      return { ...doc, edges }
    }
    case 'removeEdge': {
      if (!doc.edges.some(e => e.id === op.id)) {
        throw new Error(`removeEdge: missing id ${op.id}`)
      }
      return { ...doc, edges: doc.edges.filter(e => e.id !== op.id) }
    }
    case 'addGroup': {
      if ((doc.groups ?? []).some(g => g.id === op.group.id)) {
        throw new Error(`addGroup: duplicate id ${op.group.id}`)
      }
      return { ...doc, groups: [...(doc.groups ?? []), asGroup(op.group)] }
    }
    case 'updateGroup': {
      const groups = doc.groups ?? []
      const index = groups.findIndex(g => g.id === op.id)
      if (index < 0) throw new Error(`updateGroup: missing id ${op.id}`)
      const current = groups[index]!
      const next = groups.slice()
      next[index] = mergeGroup(current, op.patch)
      return { ...doc, groups: next }
    }
    case 'removeGroup': {
      const groups = doc.groups ?? []
      if (!groups.some(g => g.id === op.id)) {
        throw new Error(`removeGroup: missing id ${op.id}`)
      }
      return { ...doc, groups: groups.filter(g => g.id !== op.id) }
    }
    case 'setAlarms': {
      if (op.target === 'node') {
        return setNodeAlarms(doc, op.elementId, op.alarms.map(asAlarm))
      }
      return setEdgeAlarms(doc, op.elementId, op.alarms.map(asAlarm))
    }
    case 'setViewport':
      return { ...doc, viewport: op.viewport }
    case 'setSelection':
      return doc
    case 'enterSubNetwork':
    case 'exitSubNetwork':
      return doc
    default: {
      const _exhaustive: never = op
      throw new Error(`unhandled patch op: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function asAlarm(raw: {
  id: string
  level: Alarm['level']
  message: string
  ts?: string | undefined
}): Alarm {
  return raw.ts === undefined
    ? { id: raw.id, level: raw.level, message: raw.message }
    : { id: raw.id, level: raw.level, message: raw.message, ts: raw.ts }
}

function asNode(raw: {
  id: string
  type: string
  label: string
  status?: string | undefined
  x?: number | undefined
  y?: number | undefined
  w?: number | undefined
  h?: number | undefined
  parentId?: string | undefined
  groupId?: string | undefined
  networkId?: string | undefined
  alarms?: Array<{
    id: string
    level: Alarm['level']
    message: string
    ts?: string | undefined
  }> | undefined
  data?: Record<string, unknown> | undefined
}): GraphNode {
  const node: GraphNode = { id: raw.id, type: raw.type, label: raw.label }
  return applyOptionalNode(node, raw)
}

function mergeNode(
  current: GraphNode,
  patch: {
    type?: string | undefined
    label?: string | undefined
    status?: string | undefined
    x?: number | undefined
    y?: number | undefined
    w?: number | undefined
    h?: number | undefined
    parentId?: string | undefined
    groupId?: string | undefined
    networkId?: string | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | undefined
    data?: Record<string, unknown> | undefined
  },
): GraphNode {
  const base: GraphNode = {
    id: current.id,
    type: patch.type ?? current.type,
    label: patch.label ?? current.label,
  }
  return applyOptionalNode(base, {
    status: patch.status ?? current.status,
    x: patch.x ?? current.x,
    y: patch.y ?? current.y,
    w: patch.w ?? current.w,
    h: patch.h ?? current.h,
    parentId: patch.parentId ?? current.parentId,
    groupId: patch.groupId ?? current.groupId,
    networkId: patch.networkId ?? current.networkId,
    alarms: patch.alarms ?? current.alarms?.map(a => ({ ...a })),
    data: patch.data ?? (current.data !== undefined ? { ...current.data } : undefined),
  })
}

function applyOptionalNode(
  node: GraphNode,
  raw: {
    status?: string | undefined
    x?: number | undefined
    y?: number | undefined
    w?: number | undefined
    h?: number | undefined
    parentId?: string | undefined
    groupId?: string | undefined
    networkId?: string | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | readonly Alarm[] | undefined
    data?: Record<string, unknown> | undefined
  },
): GraphNode {
  return {
    ...node,
    ...(raw.status !== undefined ? { status: raw.status } : {}),
    ...(raw.x !== undefined ? { x: raw.x } : {}),
    ...(raw.y !== undefined ? { y: raw.y } : {}),
    ...(raw.w !== undefined ? { w: raw.w } : {}),
    ...(raw.h !== undefined ? { h: raw.h } : {}),
    ...(raw.parentId !== undefined ? { parentId: raw.parentId } : {}),
    ...(raw.groupId !== undefined ? { groupId: raw.groupId } : {}),
    ...(raw.networkId !== undefined ? { networkId: raw.networkId } : {}),
    ...(raw.alarms !== undefined ? { alarms: [...raw.alarms].map(asAlarm) } : {}),
    ...(raw.data !== undefined ? { data: raw.data } : {}),
  }
}

function asEdge(raw: {
  id: string
  from: string
  to: string
  kind?: string | undefined
  alarms?: Array<{
    id: string
    level: Alarm['level']
    message: string
    ts?: string | undefined
  }> | undefined
  data?: Record<string, unknown> | undefined
}): GraphEdge {
  return {
    id: raw.id,
    from: raw.from,
    to: raw.to,
    ...(raw.kind !== undefined ? { kind: raw.kind } : {}),
    ...(raw.alarms !== undefined ? { alarms: raw.alarms.map(asAlarm) } : {}),
    ...(raw.data !== undefined ? { data: raw.data } : {}),
  }
}

function mergeEdge(
  current: GraphEdge,
  patch: {
    from?: string | undefined
    to?: string | undefined
    kind?: string | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | undefined
    data?: Record<string, unknown> | undefined
  },
): GraphEdge {
  return asEdge({
    id: current.id,
    from: patch.from ?? current.from,
    to: patch.to ?? current.to,
    kind: patch.kind ?? current.kind,
    alarms: patch.alarms ?? current.alarms?.map(a => ({ ...a })),
    data: patch.data ?? (current.data !== undefined ? { ...current.data } : undefined),
  })
}

function asGroup(raw: {
  id: string
  label: string
  memberIds: readonly string[]
  x?: number | undefined
  y?: number | undefined
  w?: number | undefined
  h?: number | undefined
}): GraphGroup {
  return {
    id: raw.id,
    label: raw.label,
    memberIds: [...raw.memberIds],
    ...(raw.x !== undefined ? { x: raw.x } : {}),
    ...(raw.y !== undefined ? { y: raw.y } : {}),
    ...(raw.w !== undefined ? { w: raw.w } : {}),
    ...(raw.h !== undefined ? { h: raw.h } : {}),
  }
}

function mergeGroup(
  current: GraphGroup,
  patch: {
    label?: string | undefined
    memberIds?: readonly string[] | undefined
    x?: number | undefined
    y?: number | undefined
    w?: number | undefined
    h?: number | undefined
  },
): GraphGroup {
  return asGroup({
    id: current.id,
    label: patch.label ?? current.label,
    memberIds: patch.memberIds ?? current.memberIds,
    x: patch.x ?? current.x,
    y: patch.y ?? current.y,
    w: patch.w ?? current.w,
    h: patch.h ?? current.h,
  })
}

function setNodeAlarms(doc: GraphDocument, id: string, alarms: readonly Alarm[]): GraphDocument {
  const index = doc.nodes.findIndex(n => n.id === id)
  if (index < 0) throw new Error(`setAlarms: missing node ${id}`)
  const nodes = doc.nodes.slice()
  const current = nodes[index]!
  nodes[index] = { ...current, alarms: [...alarms] }
  return { ...doc, nodes }
}

function setEdgeAlarms(doc: GraphDocument, id: string, alarms: readonly Alarm[]): GraphDocument {
  const index = doc.edges.findIndex(e => e.id === id)
  if (index < 0) throw new Error(`setAlarms: missing edge ${id}`)
  const edges = doc.edges.slice()
  const current = edges[index]!
  edges[index] = { ...current, alarms: [...alarms] }
  return { ...doc, edges }
}
