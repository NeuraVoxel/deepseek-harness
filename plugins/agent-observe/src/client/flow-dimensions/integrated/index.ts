/**
 * Integrated atlas: panorama + loop/seam SubNetworks + event beads.
 *
 * Root groups hold the end-to-end chain and SubNetwork gateways.
 * Double-click a gateway to enter the loop or seam child document.
 * Session events appear as small red spheres near the related stage.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { linkedNodeIdForEvent } from '../events/index.ts'
import { LOOP_SKELETON, deriveLoopDimension } from '../loop/index.ts'
import { derivePanoramaDimension } from '../panorama/index.ts'
import { SEAM_SKELETON, deriveSeamDimension } from '../seam/index.ts'
import { collectTurnEvidence } from '../turn-evidence.ts'
import type {
  FlowDimensionContext,
  FlowDimensionModule,
  FlowNodeInspect,
  GraphDimensionView,
} from '../types.ts'

const NET_LOOP = 'net:loop'
const NET_SEAM = 'net:seam'
const EVENT_DIAMETER = 16
const MAX_BEADS_PER_ANCHOR = 8

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
  const durable: SessionEvent[] = []
  for (const entry of ctx.window.entries) {
    if (entry.type === 'event') durable.push(entry.event)
  }
  const turnEvents = evidence.turn === null
    ? durable
    : filterEventsForTurn(durable, evidence.turn)

  for (const event of turnEvents) {
    const linked = linkedNodeIdForEvent(event)
    const anchorId = linked === undefined ? undefined : EVENT_ANCHOR[linked] ?? linked
    if (anchorId === undefined) continue
    const anchor = anchorById.get(anchorId)
    if (anchor === undefined) continue
    const stack = beadStacks.get(anchorId) ?? 0
    if (stack >= MAX_BEADS_PER_ANCHOR) continue
    beadStacks.set(anchorId, stack + 1)

    const beadId = `event:${event.seq}`
    const ax = (anchor.x ?? 0) + (anchor.w ?? 110)
    const ay = (anchor.y ?? 0) + stack * (EVENT_DIAMETER + 4)
    rootNodes.push({
      id: beadId,
      type: 'event',
      label: '',
      status: 'error',
      x: ax + 10,
      y: ay,
      w: EVENT_DIAMETER,
      h: EVENT_DIAMETER,
      groupId: 'g-panorama',
      data: {
        meta: event.type,
        shape: 'circle',
        fill: '#ef4444',
        stroke: '#fca5a5',
      },
    })
    rootEdges.push({
      id: `${anchorId}->${beadId}`,
      from: anchorId,
      to: beadId,
      kind: 'data',
      data: {
        stroke: '#7f1d1d',
        strokeHover: '#ef4444',
        lineWidth: 1,
      },
    })
    inspectByNodeId.set(beadId, {
      detail: event.type,
      inputText: safeJson(event),
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
    document,
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

function filterEventsForTurn(events: readonly SessionEvent[], turn: number): SessionEvent[] {
  let startSeq: number | undefined
  let endSeq: number | undefined
  for (const event of events) {
    if (event.type === 'turn/start' && event.data.turn === turn) startSeq = event.seq
    if (event.type === 'turn/end' && event.data.turn === turn) endSeq = event.seq
  }
  if (startSeq === undefined) return []
  return events.filter(event => {
    if (event.seq < startSeq!) return false
    if (endSeq !== undefined && event.seq > endSeq) return false
    return true
  })
}

function safeJson(event: SessionEvent): string {
  try {
    return JSON.stringify(event, null, 2)
  } catch {
    return String(event.type)
  }
}
