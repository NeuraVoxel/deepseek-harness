/**
 * Architecture dimension (approach C): one GraphDocument with three Group
 * layers — End-to-end, Turn/Step loop, Capability seam.
 *
 * Default: loop and seam Groups show SubNetwork gateways (dblclick drills in).
 * Toolbar toggles inline the corresponding layer on the same canvas.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import { DARK_FLOW_NODE_STYLE } from '../../aitopo/dark-node-style.ts'
import { flowEdgeStyle } from '../../aitopo/flow-edge-style.ts'
import {
  appendTurnEventBeads,
  applyEventBeadFocus,
  resolveArchitectureEventAnchor,
  stripEventBeads,
} from '../event-beads.ts'
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
const LOOP_PREFIX = 'loop:'
const SEAM_PREFIX = 'seam:'

/** Vertical start of the second architecture band. */
const BAND2_Y = 300
const COLLAPSED = { w: 280, h: 48, groupW: 420, groupH: 160 } as const
const EXPANDED_LOOP = { x: 20, y: BAND2_Y, w: 880, h: 340 } as const
const EXPANDED_SEAM = { w: 860, h: 360 } as const

const COLLAPSED_LOOP_NODE = 'loop:summary'
const COLLAPSED_SEAM_NODE = 'seam:summary'

/**
 * @param id - original loop node id.
 */
function loopId(id: string): string {
  return `${LOOP_PREFIX}${id}`
}

/**
 * @param id - original seam node id.
 */
function seamId(id: string): string {
  return `${SEAM_PREFIX}${id}`
}

/**
 * Center a collapsed gateway inside a group rect.
 */
function collapsedGatewayPos(group: { x: number; y: number; w: number; h: number }): {
  x: number
  y: number
} {
  return {
    x: group.x + (group.w - COLLAPSED.w) / 2,
    y: group.y + (group.h - COLLAPSED.h) / 2,
  }
}

/**
 * @param ctx - shared dimension context.
 * @returns layered architecture graph view.
 */
export function deriveArchitectureDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const expandLoop = ctx.expandArchitectureLoop === true
  const expandSeam = ctx.expandArchitectureSeam === true
  const panorama = derivePanoramaDimension(ctx)
  const loop = deriveLoopDimension(ctx)
  const seam = deriveSeamDimension(ctx)
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)

  const rootNodes: GraphNode[] = panorama.document.nodes.map(node => ({
    ...node,
    groupId: 'g-e2e',
  }))
  const rootEdges: GraphEdge[] = [...panorama.document.edges]
  const inspectByNodeId = new Map<string, FlowNodeInspect>(panorama.inspectByNodeId)

  // Layout: both collapsed → side-by-side; otherwise stack seam under loop.
  const loopGroupRect = expandLoop
    ? EXPANDED_LOOP
    : { x: 20, y: BAND2_Y, w: COLLAPSED.groupW, h: COLLAPSED.groupH }
  const seamGroupRect = !expandLoop && !expandSeam
    ? { x: 460, y: BAND2_Y, w: COLLAPSED.groupW, h: COLLAPSED.groupH }
    : expandSeam
      ? {
        x: 20,
        y: loopGroupRect.y + loopGroupRect.h + 24,
        w: EXPANDED_SEAM.w,
        h: EXPANDED_SEAM.h,
      }
      : {
        x: 20,
        y: loopGroupRect.y + loopGroupRect.h + 24,
        w: COLLAPSED.groupW,
        h: COLLAPSED.groupH,
      }

  if (expandLoop) {
    for (const node of loop.document.nodes) {
      const id = loopId(node.id)
      rootNodes.push({
        ...node,
        id,
        x: node.x ?? 0,
        y: (node.y ?? 0) + loopGroupRect.y,
        groupId: 'g-turn-loop',
      })
      const prior = loop.inspectByNodeId?.get(node.id)
      if (prior !== undefined) inspectByNodeId.set(id, prior)
    }
    for (const edge of loop.document.edges) {
      rootEdges.push({
        ...edge,
        id: `${loopId(edge.from)}->${loopId(edge.to)}`,
        from: loopId(edge.from),
        to: loopId(edge.to),
      })
    }
    for (const bridge of [
      { from: 'envelope', to: loopId('turn-start'), label: 'turn scope' },
      { from: 'context', to: loopId('request'), label: 'per step' },
      { from: 'model', to: loopId('model'), label: 'same stage' },
      { from: 'tools', to: loopId('tools'), label: 'same stage' },
    ]) {
      rootEdges.push(scopeBridge(bridge.from, bridge.to, bridge.label))
    }
  } else {
    const pos = collapsedGatewayPos(loopGroupRect)
    rootNodes.push({
      id: COLLAPSED_LOOP_NODE,
      type: 'gateway',
      label: ctx.t('flow.architecture.loop.collapsed'),
      status: evidence.turnStarted ? (evidence.turnEnded ? 'done' : 'active') : 'pending',
      x: pos.x,
      y: pos.y,
      w: COLLAPSED.w,
      h: COLLAPSED.h,
      groupId: 'g-turn-loop',
      networkId: NET_LOOP,
      style: DARK_FLOW_NODE_STYLE,
      data: { meta: 'SubNetwork', fill: '#1f2a3a', stroke: '#5b8def' },
    })
    inspectByNodeId.set(COLLAPSED_LOOP_NODE, {
      detail: ctx.t('flow.architecture.loop.collapsed.hint'),
    })
    for (const [id, inspect] of loop.inspectByNodeId ?? []) {
      inspectByNodeId.set(id, inspect)
    }
  }

  if (expandSeam) {
    for (const node of seam.document.nodes) {
      const id = seamId(node.id)
      rootNodes.push({
        ...node,
        id,
        x: (node.x ?? 0) + seamGroupRect.x,
        y: (node.y ?? 0) + seamGroupRect.y,
        groupId: 'g-seam',
      })
      const prior = seam.inspectByNodeId?.get(node.id)
      if (prior !== undefined) inspectByNodeId.set(id, prior)
    }
    for (const edge of seam.document.edges) {
      rootEdges.push({
        ...edge,
        id: `${seamId(edge.from)}->${seamId(edge.to)}`,
        from: seamId(edge.from),
        to: seamId(edge.to),
      })
    }
    for (const bridge of [
      { from: 'tools', to: seamId('tools-consumer'), label: 'tools seam' },
      { from: 'model', to: seamId('llm-route'), label: 'llm seam' },
      { from: 'profile', to: seamId('def'), label: 'capability' },
    ]) {
      rootEdges.push(scopeBridge(bridge.from, bridge.to, bridge.label))
    }
  } else {
    const pos = collapsedGatewayPos(seamGroupRect)
    rootNodes.push({
      id: COLLAPSED_SEAM_NODE,
      type: 'gateway',
      label: ctx.t('flow.architecture.seam.collapsed'),
      status: evidence.hasTool || evidence.hasRequestHeader ? 'done' : 'pending',
      x: pos.x,
      y: pos.y,
      w: COLLAPSED.w,
      h: COLLAPSED.h,
      groupId: 'g-seam',
      networkId: NET_SEAM,
      style: DARK_FLOW_NODE_STYLE,
      data: { meta: 'SubNetwork', fill: '#243018', stroke: '#84cc16' },
    })
    inspectByNodeId.set(COLLAPSED_SEAM_NODE, {
      detail: ctx.t('flow.architecture.seam.collapsed.hint'),
    })
    for (const [id, inspect] of seam.inspectByNodeId ?? []) {
      inspectByNodeId.set(id, inspect)
    }
  }

  appendTurnEventBeads({
    nodes: rootNodes,
    edges: rootEdges,
    inspectByNodeId,
    ctx,
    resolveAnchor: (linked, anchorById) =>
      resolveArchitectureEventAnchor(linked, anchorById, LOOP_PREFIX),
  })

  const groups: GraphGroup[] = [
    {
      id: 'g-e2e',
      label: ctx.t('flow.architecture.group.e2e'),
      memberIds: rootNodes.filter(n => n.groupId === 'g-e2e').map(n => n.id),
      x: 20,
      y: 12,
      w: 1280,
      h: 280,
    },
    {
      id: 'g-turn-loop',
      label: ctx.t('flow.architecture.group.loop'),
      memberIds: rootNodes.filter(n => n.groupId === 'g-turn-loop').map(n => n.id),
      ...loopGroupRect,
    },
    {
      id: 'g-seam',
      label: ctx.t('flow.architecture.group.seam'),
      memberIds: rootNodes.filter(n => n.groupId === 'g-seam').map(n => n.id),
      ...seamGroupRect,
    },
  ]

  const document: GraphDocument = {
    version: 1,
    meta: { kind: 'flow', title: 'agent-observe-architecture' },
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

  let rendered = document
  if (ctx.focusArchitectureE2e === true) {
    rendered = stripEventBeads(rendered)
  } else if (ctx.focusEventBeads === true) {
    rendered = applyEventBeadFocus(rendered)
  }

  return {
    kind: 'graph',
    document: rendered,
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'architecture',
  }
}

/** Layered architecture dimension module. */
export const architectureDimension: FlowDimensionModule = {
  id: 'architecture',
  labelKey: 'flow.dim.architecture',
  derive: deriveArchitectureDimension,
}

function scopeBridge(from: string, to: string, label: string): GraphEdge {
  return {
    id: `bridge:${from}->${to}`,
    from,
    to,
    kind: 'data',
    label,
    style: flowEdgeStyle({
      kind: 'data',
      stroke: '#f59e0b',
      strokeHover: '#fcd34d',
      lineWidth: 1.25,
      strokeDash: [6, 4],
    }),
  }
}
