/**
 * Process-flow dimension: existing derive-flow + flowToDocument.
 */

import { flowToDocument } from '../../aitopo/flow-to-document.ts'
import type {
  FlowDimensionContext,
  FlowDimensionModule,
  FlowNodeInspect,
  GraphDimensionView,
} from '../types.ts'

/**
 * Derive the process topology graph for the focused Turn.
 * @param ctx - shared dimension context.
 */
export function deriveProcessDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const adapted = flowToDocument(ctx.agentFlow, {
    join: ctx.t('flow.join'),
    parallel: ctx.t('flow.parallel'),
  })
  const inspectByNodeId = new Map<string, FlowNodeInspect>()
  for (const node of ctx.agentFlow.nodes) {
    inspectByNodeId.set(node.id, {
      inputText: node.inputText,
      outputText: node.outputText,
      ...(node.detail === undefined ? {} : { detail: node.detail }),
    })
  }
  return {
    kind: 'graph',
    document: adapted.document,
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'process',
  }
}

/** Process dimension module registration. */
export const processDimension: FlowDimensionModule = {
  id: 'process',
  labelKey: 'flow.dim.process',
  derive: deriveProcessDimension,
}
