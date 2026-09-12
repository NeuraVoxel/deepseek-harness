/**
 * Integrated atlas: panorama + loop/seam SubNetworks + event beads.
 *
 * Root groups hold the end-to-end chain and SubNetwork gateways.
 * Double-click a gateway to enter the loop or seam child document.
 * Event beads are 1:1 with the Events tab Turn list (filter `all`); see
 * `event-beads.ts` for colors and endpoint markers.
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import { DARK_FLOW_NODE_STYLE } from '../../aitopo/dark-node-style.ts'
import {
  appendTurnEventBeads,
  applyEventBeadFocus,
  resolvePanoramaEventAnchor,
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

  appendTurnEventBeads({
    nodes: rootNodes,
    edges: rootEdges,
    inspectByNodeId,
    ctx,
    resolveAnchor: resolvePanoramaEventAnchor,
  })

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
