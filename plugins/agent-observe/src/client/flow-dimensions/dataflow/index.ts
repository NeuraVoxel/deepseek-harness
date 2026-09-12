/**
 * DataFlow dimension: E2E spine + real N×Step Session-backed topology.
 */

import type {
  FlowDimensionContext,
  FlowDimensionModule,
  GraphDimensionView,
} from '../types.ts'
import { buildDataFlowGraph } from './build-graph.ts'
import { projectDataFlowInspect } from './project-inspect.ts'

/**
 * @param ctx - shared dimension context.
 * @returns DataFlow graph with E2E + expanded Steps and payload inspect.
 */
export function deriveDataFlowDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const build = buildDataFlowGraph(ctx)
  const inspectByNodeId = projectDataFlowInspect(build, ctx.session, ctx.t)
  return {
    kind: 'graph',
    document: build.document,
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
