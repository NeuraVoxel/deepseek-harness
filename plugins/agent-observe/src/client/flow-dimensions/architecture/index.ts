/**
 * Architecture dimension (prototype of approach C): one GraphDocument with two
 * Group layers — End-to-end above, Turn/Step loop below.
 *
 * Default: loop Group shows a SubNetwork gateway (dblclick drills into the
 * standalone Turn/Step document). Toolbar「展开 Turn 环」inlines the loop on
 * the same canvas instead.
 */

import type { GraphDocument, GraphEdge, GraphNode } from '@neuravoxel/aitopo'
import { DARK_FLOW_NODE_STYLE } from '../../aitopo/dark-node-style.ts'
import {
  appendTurnEventBeads,
  applyEventBeadFocus,
  resolveArchitectureEventAnchor,
} from '../event-beads.ts'
import { LOOP_SKELETON, deriveLoopDimension } from '../loop/index.ts'
import { derivePanoramaDimension } from '../panorama/index.ts'
import { collectTurnEvidence } from '../turn-evidence.ts'
import type {
  FlowDimensionContext,
  FlowDimensionModule,
  FlowNodeInspect,
  GraphDimensionView,
} from '../types.ts'

const NET_LOOP = 'net:loop'
const LOOP_PREFIX = 'loop:'
/** Vertical gap between E2E band and Turn-loop band. */
const LOOP_Y_OFFSET = 320
const COLLAPSED_LOOP_NODE = 'loop:summary'
const COLLAPSED_LOOP_GROUP = { x: 20, y: LOOP_Y_OFFSET - 20, w: 420, h: 160 } as const
const COLLAPSED_SUMMARY = { w: 280, h: 48 } as const
/** Center the collapsed gateway inside `g-turn-loop`. */
const COLLAPSED_SUMMARY_POS = {
  x: COLLAPSED_LOOP_GROUP.x + (COLLAPSED_LOOP_GROUP.w - COLLAPSED_SUMMARY.w) / 2,
  y: COLLAPSED_LOOP_GROUP.y + (COLLAPSED_LOOP_GROUP.h - COLLAPSED_SUMMARY.h) / 2,
} as const

/**
 * Remap loop skeleton ids so they do not collide with panorama `model` / `tools`.
 * @param id - original loop node id.
 */
function loopId(id: string): string {
  return `${LOOP_PREFIX}${id}`
}

/**
 * @param ctx - shared dimension context.
 * @returns layered architecture graph view.
 */
export function deriveArchitectureDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const expandLoop = ctx.expandArchitectureLoop === true
  const panorama = derivePanoramaDimension(ctx)
  const loop = deriveLoopDimension(ctx)
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)

  const rootNodes: GraphNode[] = panorama.document.nodes.map(node => ({
    ...node,
    groupId: 'g-e2e',
  }))
  const rootEdges: GraphEdge[] = [...panorama.document.edges]
  const inspectByNodeId = new Map<string, FlowNodeInspect>(panorama.inspectByNodeId)

  if (expandLoop) {
    for (const node of loop.document.nodes) {
      const id = loopId(node.id)
      rootNodes.push({
        ...node,
        id,
        x: node.x,
        y: node.y + LOOP_Y_OFFSET,
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
    const bridges: Array<{ from: string; to: string; label: string }> = [
      { from: 'envelope', to: loopId('turn-start'), label: 'turn scope' },
      { from: 'context', to: loopId('request'), label: 'per step' },
      { from: 'model', to: loopId('model'), label: 'same stage' },
      { from: 'tools', to: loopId('tools'), label: 'same stage' },
    ]
    for (const bridge of bridges) {
      rootEdges.push({
        id: `bridge:${bridge.from}->${bridge.to}`,
        from: bridge.from,
        to: bridge.to,
        kind: 'data',
        data: {
          stroke: '#f59e0b',
          strokeHover: '#fcd34d',
          lineWidth: 1.25,
          strokeDash: [6, 4],
          label: bridge.label,
        },
      })
    }
  } else {
    rootNodes.push({
      id: COLLAPSED_LOOP_NODE,
      type: 'gateway',
      label: ctx.t('flow.architecture.loop.collapsed'),
      status: evidence.turnStarted ? (evidence.turnEnded ? 'done' : 'active') : 'pending',
      x: COLLAPSED_SUMMARY_POS.x,
      y: COLLAPSED_SUMMARY_POS.y,
      w: COLLAPSED_SUMMARY.w,
      h: COLLAPSED_SUMMARY.h,
      groupId: 'g-turn-loop',
      networkId: NET_LOOP,
      style: DARK_FLOW_NODE_STYLE,
      data: {
        meta: 'SubNetwork',
        fill: '#1f2a3a',
        stroke: '#5b8def',
      },
    })
    inspectByNodeId.set(COLLAPSED_LOOP_NODE, {
      detail: ctx.t('flow.architecture.loop.collapsed.hint'),
    })
    for (const [id, inspect] of loop.inspectByNodeId ?? []) {
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

  const e2eMembers = rootNodes.filter(n => n.groupId === 'g-e2e').map(n => n.id)
  const loopMembers = rootNodes.filter(n => n.groupId === 'g-turn-loop').map(n => n.id)

  const document: GraphDocument = {
    version: 1,
    meta: { kind: 'flow', title: 'agent-observe-architecture' },
    nodes: rootNodes,
    edges: rootEdges,
    groups: [
      {
        id: 'g-e2e',
        label: ctx.t('flow.architecture.group.e2e'),
        memberIds: e2eMembers,
        x: 20,
        y: 12,
        w: 1280,
        h: 280,
      },
      {
        id: 'g-turn-loop',
        label: ctx.t('flow.architecture.group.loop'),
        memberIds: loopMembers,
        x: expandLoop ? 20 : COLLAPSED_LOOP_GROUP.x,
        y: expandLoop ? LOOP_Y_OFFSET - 20 : COLLAPSED_LOOP_GROUP.y,
        w: expandLoop ? 880 : COLLAPSED_LOOP_GROUP.w,
        h: expandLoop ? 340 : COLLAPSED_LOOP_GROUP.h,
      },
    ],
    networks: {
      [NET_LOOP]: {
        ...loop.document,
        meta: { kind: 'flow', title: LOOP_SKELETON.title },
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
    legend: 'architecture',
  }
}

/** Layered architecture dimension module. */
export const architectureDimension: FlowDimensionModule = {
  id: 'architecture',
  labelKey: 'flow.dim.architecture',
  derive: deriveArchitectureDimension,
}
