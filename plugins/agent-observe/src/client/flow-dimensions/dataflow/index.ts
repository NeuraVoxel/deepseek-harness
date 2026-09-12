/**
 * DataFlow dimension: E2E spine + real N×Step Session-backed topology.
 */

import type { GraphDocument, GraphGroup } from '@neuravoxel/aitopo'
import {
  appendTurnEventBeads,
  applyEventBeadFocus,
  createDataFlowEventAnchorResolver,
} from '../event-beads.ts'
import type {
  FlowDimensionContext,
  FlowDimensionModule,
  GraphDimensionView,
} from '../types.ts'
import { buildDataFlowGraph } from './build-graph.ts'
import { projectDataFlowInspect } from './project-inspect.ts'

/**
 * @param ctx - shared dimension context.
 * @returns DataFlow graph with E2E + expanded Steps, event beads, and payload inspect.
 */
export function deriveDataFlowDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const build = buildDataFlowGraph(ctx)
  const inspectByNodeId = projectDataFlowInspect(build, ctx.session, ctx.t)
  const nodes = [...build.document.nodes]
  const edges = [...build.document.edges]
  appendTurnEventBeads({
    nodes,
    edges,
    inspectByNodeId,
    ctx,
    resolveAnchor: createDataFlowEventAnchorResolver(),
  })

  let document: GraphDocument = {
    ...build.document,
    nodes,
    edges,
    ...(build.document.groups === undefined
      ? {}
      : { groups: withBeadMembers(build.document.groups, nodes) }),
  }
  if (ctx.focusEventBeads === true) {
    document = applyEventBeadFocus(document)
  }

  return {
    kind: 'graph',
    document,
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'dataflow',
  }
}

/** DataFlow dimension module. */
export const dataflowDimension: FlowDimensionModule = {
  id: 'dataflow',
  labelKey: 'flow.dim.dataflow',
  derive: deriveDataFlowDimension,
}

/**
 * Include beads that inherited an anchor groupId in that group's memberIds.
 * @param groups - groups built before beads were appended.
 * @param nodes - nodes including beads.
 */
function withBeadMembers(
  groups: readonly GraphGroup[],
  nodes: readonly { readonly id: string, readonly groupId?: string }[],
): GraphGroup[] {
  return groups.map(group => {
    const extras = nodes
      .filter(node => node.groupId === group.id && !group.memberIds.includes(node.id))
      .map(node => node.id)
    if (extras.length === 0) return group
    return { ...group, memberIds: [...group.memberIds, ...extras] }
  })
}
