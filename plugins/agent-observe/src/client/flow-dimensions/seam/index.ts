/**
 * Capability-seam teaching skeleton with a tools/* nested example.
 */

import type { FlowNodeStatus } from '../../derive-flow.ts'
import { skeletonToDocument, type SkeletonGraph } from '../skeleton-document.ts'
import { collectTurnEvidence, statusFromSeen } from '../turn-evidence.ts'
import type {
  FlowDimensionContext,
  FlowDimensionModule,
  FlowNodeInspect,
  GraphDimensionView,
} from '../types.ts'

/** Definition → Provider → Consumer triangle + tools nested lane. */
export const SEAM_SKELETON: SkeletonGraph = {
  title: 'agent-observe-seam',
  nodes: [
    { id: 'def', label: 'Definition', x: 200, y: 40, w: 130, h: 48, fill: '#1a2740', detail: 'Service contract' },
    { id: 'provider', label: 'Provider', x: 40, y: 180, w: 130, h: 48, fill: '#243018', detail: 'Implementation' },
    { id: 'consumer', label: 'Consumer', x: 360, y: 180, w: 130, h: 48, fill: '#1f2a3a', detail: 'Caller / tool face' },
    { id: 'tools-schema', label: 'tools schema', x: 620, y: 40, w: 140, h: 44, fill: '#3a1530', detail: 'Registered tool schemas' },
    { id: 'tools-provider', label: 'tool provider', x: 620, y: 120, w: 140, h: 44, fill: '#3a1530', detail: 'Executor for a tool name' },
    { id: 'tools-consumer', label: 'agent-loop / tools', x: 620, y: 200, w: 160, h: 44, fill: '#3a2a10', detail: 'Model tool calls' },
    { id: 'llm-route', label: 'LLM route', x: 200, y: 300, w: 130, h: 44, fill: '#3a2a10', detail: 'Provider + model' },
  ],
  edges: [
    { from: 'def', to: 'provider', kind: 'flow' },
    { from: 'def', to: 'consumer', kind: 'flow' },
    { from: 'provider', to: 'consumer', kind: 'data', label: 'satisfies' },
    { from: 'def', to: 'tools-schema', kind: 'flow', label: 'example: tools/*' },
    { from: 'tools-schema', to: 'tools-provider', kind: 'flow' },
    { from: 'tools-provider', to: 'tools-consumer', kind: 'data' },
    { from: 'consumer', to: 'tools-consumer', kind: 'flow' },
    { from: 'def', to: 'llm-route', kind: 'flow', label: 'llm seam' },
  ],
  groups: [
    {
      id: 'g-triangle',
      label: 'Capability seam (C)',
      memberIds: ['def', 'provider', 'consumer'],
      x: 20,
      y: 10,
      w: 500,
      h: 260,
    },
    {
      id: 'g-tools',
      label: 'Nested: tools/*',
      memberIds: ['tools-schema', 'tools-provider', 'tools-consumer'],
      x: 560,
      y: 10,
      w: 240,
      h: 260,
    },
  ],
}

/**
 * @param ctx - shared dimension context.
 * @returns seam graph view.
 */
export function deriveSeamDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)
  const statusById = new Map<string, FlowNodeStatus>()
  // Triangle stays mostly explanatory; light only with tool/LLM evidence.
  statusById.set('def', evidence.hasTool || evidence.hasRequestHeader ? 'done' : 'pending')
  statusById.set('provider', evidence.hasTool ? 'done' : 'pending')
  statusById.set('consumer', statusFromSeen(evidence, evidence.hasTool || evidence.hasAssistant, {
    activeWhenLive: evidence.live,
  }))
  statusById.set('tools-schema', statusFromSeen(evidence, evidence.hasRequestHeader || evidence.hasTool))
  statusById.set('tools-provider', statusFromSeen(evidence, evidence.hasTool, {
    activeWhenLive: evidence.hasTool && evidence.openStep,
  }))
  statusById.set('tools-consumer', statusFromSeen(evidence, evidence.hasTool || evidence.hasAssistant, {
    activeWhenLive: evidence.openStep,
  }))
  statusById.set('llm-route', statusFromSeen(evidence, evidence.hasRequestHeader || evidence.hasAssistant, {
    activeWhenLive: evidence.openStep,
  }))

  const inspectByNodeId = new Map<string, FlowNodeInspect>()
  inspectByNodeId.set('def', {
    detail: 'Service Definition / Provider / Consumer — one complete capability seam',
  })
  if (evidence.toolNames.length > 0) {
    inspectByNodeId.set('tools-provider', { detail: evidence.toolNames.join(', ') })
    inspectByNodeId.set('tools-consumer', { detail: `Observed tools: ${evidence.toolNames.join(', ')}` })
  } else {
    inspectByNodeId.set('tools-provider', {
      detail: 'No tool/execution in this Turn — skeleton stays explanatory',
    })
  }

  return {
    kind: 'graph',
    document: skeletonToDocument(SEAM_SKELETON, statusById),
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'status',
  }
}

/** Seam dimension module. */
export const seamDimension: FlowDimensionModule = {
  id: 'seam',
  labelKey: 'flow.dim.seam',
  derive: deriveSeamDimension,
}
