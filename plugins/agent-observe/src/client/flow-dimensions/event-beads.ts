/**
 * Turn-scoped event beads shared by Atlas and Architecture dimensions.
 *
 * Beads are 1:1 with the Events tab Turn list (filter `all`). Mid beads and
 * seq / stem edges use orange; first seq is start (red), last is end (green).
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { colorWithAlpha } from '../aitopo/color-alpha.ts'
import { DARK_EVENT_BEAD_STYLE, DARK_FLOW_NODE_STYLE } from '../aitopo/dark-node-style.ts'
import { linkedNodeIdForEvent } from './events/index.ts'
import {
  collectTurnEvidence,
  durableEventsFromWindow,
  listEventsForTurn,
} from './turn-evidence.ts'
import type { FlowDimensionContext, FlowNodeInspect } from './types.ts'

export const EVENT_DIAMETER = 16
/** Mid-chain beads and seq / stem edges — orange family. */
export const BEAD_FILL = '#f97316'
export const BEAD_STROKE = '#fdba74'
export const BEAD_EDGE_STROKE = '#ea580c'
export const BEAD_EDGE_HOVER = '#fbbf24'
export const BEAD_SEQ_STROKE = '#fb923c'
export const BEAD_SEQ_HOVER = '#fde68a'
/** First seq bead — red family. */
export const BEAD_START_FILL = '#dc2626'
export const BEAD_START_STROKE = '#fecaca'
/** Last seq bead — green family. */
export const BEAD_END_FILL = '#16a34a'
export const BEAD_END_STROKE = '#86efac'
/** Fallback stage for SessionEvents without a dedicated mapping. */
export const FALLBACK_ANCHOR = 'durable'

/** Map loop/seam-oriented event links onto panorama stage ids. */
export const EVENT_ANCHOR_PANORAMA: Readonly<Record<string, string>> = {
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

export interface AppendEventBeadsArgs {
  readonly nodes: GraphNode[]
  readonly edges: GraphEdge[]
  readonly inspectByNodeId: Map<string, FlowNodeInspect>
  readonly ctx: FlowDimensionContext
  /**
   * Resolve which existing node id should host the bead.
   * @param linked - Events-tab linkedNodeId, or undefined when unmapped.
   * @param anchorById - nodes present on the canvas.
   */
  readonly resolveAnchor: (
    linked: string | undefined,
    anchorById: ReadonlyMap<string, GraphNode>,
  ) => string | undefined
}

/**
 * Append beads + stem + seq edges for the focused Turn (mutates arrays/maps).
 * @param args - placement inputs.
 * @returns ordered bead ids (seq order).
 */
export function appendTurnEventBeads(args: AppendEventBeadsArgs): string[] {
  const { nodes, edges, inspectByNodeId, ctx, resolveAnchor } = args
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)
  const anchorById = new Map(nodes.map(node => [node.id, node]))
  const beadStacks = new Map<string, number>()
  const turnEvents = listEventsForTurn(
    durableEventsFromWindow(ctx.window),
    evidence.turn,
  )
  const beadIds: string[] = []

  for (const event of turnEvents) {
    const linked = linkedNodeIdForEvent(event)
    const anchorId = resolveAnchor(linked, anchorById)
    if (anchorId === undefined) continue
    const anchor = anchorById.get(anchorId)
    if (anchor === undefined) continue
    const stack = beadStacks.get(anchorId) ?? 0
    beadStacks.set(anchorId, stack + 1)

    const beadId = `event:${event.seq}`
    const ax = (anchor.x ?? 0) + (anchor.w ?? 110)
    const ay = (anchor.y ?? 0) + stack * (EVENT_DIAMETER + 4)
    const seqLabel = String(event.seq)
    nodes.push({
      id: beadId,
      type: 'event',
      label: seqLabel,
      status: 'error',
      x: ax + 10,
      y: ay,
      w: EVENT_DIAMETER,
      h: EVENT_DIAMETER,
      groupId: anchor.groupId,
      style: DARK_EVENT_BEAD_STYLE,
      data: {
        meta: event.type,
        shape: 'circle',
        fill: BEAD_FILL,
        stroke: BEAD_STROKE,
      },
    })
    edges.push({
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

  markEventBeadEndpoints(nodes, beadIds, inspectByNodeId, ctx.t)

  for (let index = 0; index < beadIds.length - 1; index += 1) {
    const from = beadIds[index]!
    const to = beadIds[index + 1]!
    edges.push({
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

  return beadIds
}

/**
 * Panorama-only anchor resolution (Atlas root).
 * @param linked - Events linkedNodeId.
 * @param anchorById - root nodes.
 */
export function resolvePanoramaEventAnchor(
  linked: string | undefined,
  anchorById: ReadonlyMap<string, GraphNode>,
): string | undefined {
  const preferred = linked === undefined
    ? FALLBACK_ANCHOR
    : EVENT_ANCHOR_PANORAMA[linked] ?? linked
  if (anchorById.has(preferred)) return preferred
  return anchorById.has(FALLBACK_ANCHOR) ? FALLBACK_ANCHOR : undefined
}

/**
 * Architecture canvas: prefer Turn-loop nodes when present, else E2E stages.
 * @param linked - Events linkedNodeId.
 * @param anchorById - canvas nodes.
 * @param loopPrefix - id prefix for loop nodes (e.g. `loop:`).
 */
export function resolveArchitectureEventAnchor(
  linked: string | undefined,
  anchorById: ReadonlyMap<string, GraphNode>,
  loopPrefix: string,
): string | undefined {
  if (linked !== undefined) {
    const onLoop = `${loopPrefix}${linked}`
    if (anchorById.has(onLoop)) return onLoop
  }
  return resolvePanoramaEventAnchor(linked, anchorById)
}

/**
 * Dim non-event root chrome so beads + seq edges read as the focus path.
 * @param document - graph to fade.
 */
export function applyEventBeadFocus(document: GraphDocument): GraphDocument {
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

/**
 * Recolor the first / last seq beads as start and end markers (same size).
 * @param nodes - mutable node list.
 * @param beadIds - seq-ordered bead ids.
 * @param inspectByNodeId - inspect map.
 * @param t - locale lookup.
 */
export function markEventBeadEndpoints(
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

function safeJson(event: SessionEvent): string {
  try {
    return JSON.stringify(event, null, 2)
  } catch {
    return String(event.type)
  }
}
