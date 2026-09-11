/**
 * Integrated atlas: panorama + loop/seam SubNetworks + event beads.
 *
 * Root groups hold the end-to-end chain and SubNetwork gateways.
 * Double-click a gateway to enter the loop or seam child document.
 * Red beads are 1:1 with the Events tab Turn list (filter `all`); unmapped
 * types hang on the Session-write stage. The first seq bead is the start
 * marker (deeper red) and the last is the end marker (green); mid beads and
 * seq edges use orange.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { colorWithAlpha } from '../../aitopo/color-alpha.ts'
import { DARK_EVENT_BEAD_STYLE, DARK_FLOW_NODE_STYLE } from '../../aitopo/dark-node-style.ts'
import { linkedNodeIdForEvent } from '../events/index.ts'
import { LOOP_SKELETON, deriveLoopDimension } from '../loop/index.ts'
import { derivePanoramaDimension } from '../panorama/index.ts'
import { SEAM_SKELETON, deriveSeamDimension } from '../seam/index.ts'
import {
  collectTurnEvidence,
  durableEventsFromWindow,
  listEventsForTurn,
} from '../turn-evidence.ts'
import type {
  FlowDimensionContext,
  FlowDimensionModule,
  FlowNodeInspect,
  GraphDimensionView,
} from '../types.ts'

const NET_LOOP = 'net:loop'
const NET_SEAM = 'net:seam'
const EVENT_DIAMETER = 16
/** Mid-chain beads and seq / stem edges — orange family. */
const BEAD_FILL = '#f97316'
const BEAD_STROKE = '#fdba74'
const BEAD_EDGE_STROKE = '#ea580c'
const BEAD_EDGE_HOVER = '#fbbf24'
const BEAD_SEQ_STROKE = '#fb923c'
const BEAD_SEQ_HOVER = '#fde68a'
/** First seq bead — red family. */
const BEAD_START_FILL = '#dc2626'
const BEAD_START_STROKE = '#fecaca'
/** Last seq bead — green family. */
const BEAD_END_FILL = '#16a34a'
const BEAD_END_STROKE = '#86efac'
/** Fallback panorama node for SessionEvents without a dedicated stage mapping. */
const FALLBACK_ANCHOR = 'durable'

/** Map loop/seam-oriented event links onto panorama stage ids for bead anchors. */
const EVENT_ANCHOR: Readonly<Record<string, string>> = {
  'turn-start': 'admit',
  'turn-end': 'admit',
  'step-start': 'context',
  'step-end': 'context',
  request: 'envelope',
  model: 'model',
  tools: 'tools',
  client: 'client',
  preset: 'preset',
}

/**
 * @param ctx - shared dimension context.
 * @returns integrated atlas graph view.
 */
export function deriveIntegratedDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const panorama = derivePanoramaDimension(ctx)
  const loop = deriveLoopDimension(ctx)
  const seam = deriveSeamDimension(ctx)
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)

  const rootNodes: GraphNode[] = panorama.document.nodes.map(node => ({
    ...node,
    groupId: 'g-panorama',
  }))
  const rootEdges: GraphEdge[] = [...panorama.document.edges]
  const inspectByNodeId = new Map<string, FlowNodeInspect>(panorama.inspectByNodeId)

  const loopGate: GraphNode = {
    id: 'gate:loop',
    type: 'gateway',
    label: ctx.t('flow.integrated.gate.loop'),
    status: evidence.turnStarted ? (evidence.turnEnded ? 'done' : 'active') : 'pending',
    x: 40,
    y: 320,
    w: 200,
    h: 56,
    groupId: 'g-loop',
    networkId: NET_LOOP,
    style: DARK_FLOW_NODE_STYLE,
    data: {
      meta: 'SubNetwork',
      fill: '#1f2a3a',
      stroke: '#5b8def',
    },
  }
  const seamGate: GraphNode = {
    id: 'gate:seam',
    type: 'gateway',
    label: ctx.t('flow.integrated.gate.seam'),
    status: evidence.hasTool || evidence.hasRequestHeader ? 'done' : 'pending',
    x: 280,
    y: 320,
    w: 200,
    h: 56,
    groupId: 'g-seam',
    networkId: NET_SEAM,
    style: DARK_FLOW_NODE_STYLE,
    data: {
      meta: 'SubNetwork',
      fill: '#243018',
      stroke: '#84cc16',
    },
  }
  rootNodes.push(loopGate, seamGate)
  inspectByNodeId.set('gate:loop', {
    detail: ctx.t('flow.integrated.gate.loop.hint'),
  })
  inspectByNodeId.set('gate:seam', {
    detail: ctx.t('flow.integrated.gate.seam.hint'),
  })

  const anchorById = new Map(rootNodes.map(node => [node.id, node]))
  const beadStacks = new Map<string, number>()
  // Same Turn window as the Events dimension (filter `all`).
  const turnEvents = listEventsForTurn(
    durableEventsFromWindow(ctx.window),
    evidence.turn,
  )
  const beadIds: string[] = []

  for (const event of turnEvents) {
    const linked = linkedNodeIdForEvent(event)
    const preferred = linked === undefined ? FALLBACK_ANCHOR : EVENT_ANCHOR[linked] ?? linked
    const anchorId = anchorById.has(preferred)
      ? preferred
      : (anchorById.has(FALLBACK_ANCHOR) ? FALLBACK_ANCHOR : undefined)
    if (anchorId === undefined) continue
    const anchor = anchorById.get(anchorId)
    if (anchor === undefined) continue
    const stack = beadStacks.get(anchorId) ?? 0
    beadStacks.set(anchorId, stack + 1)

    const beadId = `event:${event.seq}`
    const ax = (anchor.x ?? 0) + (anchor.w ?? 110)
    const ay = (anchor.y ?? 0) + stack * (EVENT_DIAMETER + 4)
    const seqLabel = String(event.seq)
    rootNodes.push({
      id: beadId,
      type: 'event',
      label: seqLabel,
      status: 'error',
      x: ax + 10,
      y: ay,
      w: EVENT_DIAMETER,
      h: EVENT_DIAMETER,
      groupId: 'g-panorama',
      style: DARK_EVENT_BEAD_STYLE,
      data: {
        meta: event.type,
        shape: 'circle',
        fill: BEAD_FILL,
        stroke: BEAD_STROKE,
      },
    })
    rootEdges.push({
      id: `${anchorId}->${beadId}`,
      from: anchorId,
      to: beadId,
      kind: 'data',
      data: {
        stroke: BEAD_EDGE_STROKE,
        strokeHover: BEAD_EDGE_HOVER,
        lineWidth: 1,
      },
    })
    inspectByNodeId.set(beadId, {
      detail: `${event.type} · seq ${seqLabel}`,
      inputText: safeJson(event),
    })
    beadIds.push(beadId)
  }

  markEventBeadEndpoints(rootNodes, beadIds, inspectByNodeId, ctx.t)

  // Chronological chain: consecutive Session seq beads linked with dashed edges.
  for (let index = 0; index < beadIds.length - 1; index += 1) {
    const from = beadIds[index]!
    const to = beadIds[index + 1]!
    rootEdges.push({
      id: `event-seq:${from}->${to}`,
      from,
      to,
      kind: 'data',
      data: {
        stroke: BEAD_SEQ_STROKE,
        strokeHover: BEAD_SEQ_HOVER,
        lineWidth: 1.5,
        strokeDash: [5, 4],
      },
    })
  }

  // Carry loop/seam inspect maps under prefixed child ids for SubNetwork selection.
  for (const [id, inspect] of loop.inspectByNodeId ?? []) {
    inspectByNodeId.set(id, inspect)
  }
  for (const [id, inspect] of seam.inspectByNodeId ?? []) {
    inspectByNodeId.set(id, inspect)
  }

  const groups: GraphGroup[] = [
    {
      id: 'g-panorama',
      label: ctx.t('flow.integrated.group.panorama'),
      memberIds: rootNodes.filter(n => n.groupId === 'g-panorama').map(n => n.id),
      x: 20,
      y: 16,
      w: 1260,
      h: 280,
    },
    {
      id: 'g-loop',
      label: ctx.t('flow.integrated.group.loop'),
      memberIds: ['gate:loop'],
      x: 20,
      y: 300,
      w: 240,
      h: 100,
    },
    {
      id: 'g-seam',
      label: ctx.t('flow.integrated.group.seam'),
      memberIds: ['gate:seam'],
      x: 260,
      y: 300,
      w: 240,
      h: 100,
    },
  ]

  const document: GraphDocument = {
    version: 1,
    meta: { kind: 'flow', title: 'agent-observe-integrated' },
    nodes: rootNodes,
    edges: rootEdges,
    groups,
    networks: {
      [NET_LOOP]: {
        ...loop.document,
        meta: { kind: 'flow', title: LOOP_SKELETON.title },
      },
      [NET_SEAM]: {
        ...seam.document,
        meta: { kind: 'flow', title: SEAM_SKELETON.title },
      },
    },
  }

  return {
    kind: 'graph',
    document: ctx.focusEventBeads === true
      ? applyEventBeadFocus(document)
      : document,
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'integrated',
  }
}

/** Integrated atlas dimension module. */
export const integratedDimension: FlowDimensionModule = {
  id: 'integrated',
  labelKey: 'flow.dim.integrated',
  derive: deriveIntegratedDimension,
}

/**
 * Dim non-event root chrome so beads + seq edges read as the focus path.
 * Nodes use `style.alpha`; edges/groups use rgba strokes (no GraphEdge.alpha yet —
 * request that from aitopo when available).
 */
function applyEventBeadFocus(document: GraphDocument): GraphDocument {
  const dim = 0.2
  const nodes = document.nodes.map(node => {
    const focused = isEventBead(node)
    const base = node.style ?? (focused ? DARK_EVENT_BEAD_STYLE : DARK_FLOW_NODE_STYLE)
    return {
      ...node,
      style: {
        ...base,
        showIcon: base.showIcon ?? false,
        alpha: focused ? 1 : dim,
      },
    }
  })
  const edges = document.edges.map(edge => {
    const focused = edge.id.startsWith('event-seq:')
    const data = edge.data ?? {}
    const stroke = typeof data.stroke === 'string' ? data.stroke : '#5a6478'
    const strokeHover = typeof data.strokeHover === 'string' ? data.strokeHover : '#3b82f6'
    const alpha = focused ? 1 : dim
    return {
      ...edge,
      data: {
        ...data,
        stroke: colorWithAlpha(stroke, alpha),
        strokeHover: colorWithAlpha(strokeHover, alpha),
      },
    }
  })
  const groups = document.groups?.map(group => fadeGroup(group, dim))
  return {
    ...document,
    nodes,
    edges,
    ...(groups === undefined ? {} : { groups }),
  }
}

function fadeGroup(group: GraphGroup, alpha: number): GraphGroup {
  const style = group.style ?? {}
  const stroke = typeof style.stroke === 'string' ? style.stroke : '#5a6478'
  const fill = typeof style.fill === 'string' ? style.fill : 'rgba(90, 100, 120, 0.08)'
  return {
    ...group,
    style: {
      ...style,
      stroke: colorWithAlpha(stroke, alpha),
      fill: colorWithAlpha(fill, alpha),
    },
  }
}

function isEventBead(node: GraphNode): boolean {
  return node.type === 'event' || node.id.startsWith('event:')
}

/**
 * Recolor the first / last seq beads as start and end markers (same size).
 * A single bead is both start and end (start fill, end stroke).
 */
function markEventBeadEndpoints(
  nodes: GraphNode[],
  beadIds: readonly string[],
  inspectByNodeId: Map<string, FlowNodeInspect>,
  t: FlowDimensionContext['t'],
): void {
  if (beadIds.length === 0) return
  const firstId = beadIds[0]!
  const lastId = beadIds[beadIds.length - 1]!
  const byId = new Map(nodes.map((node, index) => [node.id, index]))

  const paintEndpoint = (
    id: string,
    role: 'start' | 'end' | 'both',
  ): void => {
    const index = byId.get(id)
    if (index === undefined) return
    const node = nodes[index]!
    const fill = role === 'end' ? BEAD_END_FILL : BEAD_START_FILL
    const stroke = role === 'start' ? BEAD_START_STROKE : BEAD_END_STROKE
    const roleLabel = role === 'start'
      ? t('flow.integrated.bead.start')
      : role === 'end'
        ? t('flow.integrated.bead.end')
        : t('flow.integrated.bead.both')
    nodes[index] = {
      ...node,
      style: DARK_EVENT_BEAD_STYLE,
      data: {
        ...node.data,
        shape: 'circle',
        fill,
        stroke,
        endpoint: role,
      },
    }
    const prior = inspectByNodeId.get(id)
    inspectByNodeId.set(id, {
      ...prior,
      detail: prior?.detail !== undefined && prior.detail !== ''
        ? `${roleLabel} · ${prior.detail}`
        : roleLabel,
    })
  }

  if (beadIds.length === 1) {
    paintEndpoint(firstId, 'both')
    return
  }
  paintEndpoint(firstId, 'start')
  paintEndpoint(lastId, 'end')
}

function safeJson(event: SessionEvent): string {
  try {
    return JSON.stringify(event, null, 2)
  } catch {
    return String(event.type)
  }
}
