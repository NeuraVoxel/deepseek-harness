/**
 * Turn / Step recirculation skeleton + overlay.
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

/** Ring-like layout: turn → step → model → tools → step/end → turn/end. */
export const LOOP_SKELETON: SkeletonGraph = {
  title: 'agent-observe-loop',
  nodes: [
    { id: 'turn-start', label: 'turn/start', x: 80, y: 160, w: 120, h: 44, fill: '#152a48' },
    { id: 'step-start', label: 'step/start', x: 280, y: 60, w: 120, h: 44, fill: '#1f2a3a' },
    { id: 'request', label: 'request + context', x: 480, y: 60, w: 140, h: 44, fill: '#243018' },
    { id: 'model', label: 'model', x: 700, y: 60, w: 110, h: 44, fill: '#3a2a10' },
    { id: 'tools', label: 'tools ×N', x: 755, y: 200, w: 56, h: 56, fill: '#3a1530', shape: 'circle', type: 'tool' },
    { id: 'step-end', label: 'step/end', x: 480, y: 260, w: 120, h: 44, fill: '#1f2a3a' },
    { id: 'turn-end', label: 'turn/end', x: 280, y: 260, w: 120, h: 44, fill: '#152a48' },
  ],
  edges: [
    { from: 'turn-start', to: 'step-start', kind: 'flow' },
    { from: 'step-start', to: 'request', kind: 'flow' },
    { from: 'request', to: 'model', kind: 'data' },
    { from: 'model', to: 'tools', kind: 'flow' },
    { from: 'tools', to: 'model', kind: 'data', label: 'results' },
    { from: 'model', to: 'step-end', kind: 'flow' },
    { from: 'tools', to: 'step-end', kind: 'flow' },
    { from: 'step-end', to: 'step-start', kind: 'flow', label: 'next step' },
    { from: 'step-end', to: 'turn-end', kind: 'flow' },
  ],
  groups: [
    { id: 'g-loop', label: 'Turn / Step loop', memberIds: [
      'turn-start', 'step-start', 'request', 'model', 'tools', 'step-end', 'turn-end',
    ], x: 40, y: 20, w: 820, h: 320 },
  ],
}

/**
 * @param ctx - shared dimension context.
 * @returns loop graph view.
 */
export function deriveLoopDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)
  const statusById = new Map<string, FlowNodeStatus>()
  statusById.set('turn-start', statusFromSeen(evidence, evidence.turnStarted, {
    activeWhenLive: evidence.turnStarted && evidence.stepCount === 0,
    errorWithTurn: true,
  }))
  statusById.set('step-start', statusFromSeen(evidence, evidence.stepCount > 0 || evidence.openStep, {
    activeWhenLive: evidence.openStep,
  }))
  statusById.set('request', statusFromSeen(evidence, evidence.hasRequestHeader || evidence.stepCount > 0, {
    activeWhenLive: evidence.openStep && !evidence.hasAssistant,
  }))
  statusById.set('model', statusFromSeen(evidence, evidence.hasAssistant || evidence.stepCount > 0, {
    activeWhenLive: evidence.openStep,
    errorWithTurn: true,
  }))
  statusById.set('tools', statusFromSeen(evidence, evidence.hasTool, {
    activeWhenLive: evidence.hasTool && evidence.openStep,
  }))
  const stepEnded = evidence.stepCount > 0 && !evidence.openStep
  statusById.set('step-end', statusFromSeen(evidence, stepEnded || evidence.turnEnded, {
    activeWhenLive: evidence.openStep === false && evidence.live && !evidence.turnEnded,
  }))
  statusById.set('turn-end', statusFromSeen(evidence, evidence.turnEnded, {
    errorWithTurn: true,
  }))

  const inspectByNodeId = new Map<string, FlowNodeInspect>()
  if (evidence.turn !== null) {
    inspectByNodeId.set('turn-start', { detail: `Turn ${evidence.turn}` })
    inspectByNodeId.set('step-start', {
      detail: evidence.stepCount === 0
        ? 'No step/start yet'
        : `${evidence.stepCount} step(s)${evidence.openStep ? ' · open' : ''}`,
    })
    inspectByNodeId.set('tools', {
      detail: evidence.toolNames.length > 0
        ? `×${evidence.toolNames.length}: ${evidence.toolNames.join(', ')}`
        : 'No tools this Turn',
    })
    if (evidence.endReasonKind !== null) {
      inspectByNodeId.set('turn-end', { detail: `reason: ${evidence.endReasonKind}` })
    }
  }

  return {
    kind: 'graph',
    document: skeletonToDocument(LOOP_SKELETON, statusById),
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'status',
  }
}

/** Loop dimension module. */
export const loopDimension: FlowDimensionModule = {
  id: 'loop',
  labelKey: 'flow.dim.loop',
  derive: deriveLoopDimension,
}
