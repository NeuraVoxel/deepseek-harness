/**
 * End-to-end panorama skeleton + conservative Turn overlay.
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

/** Static Client ↔ Host ↔ Model/Tools ↔ render panorama. */
export const PANORAMA_SKELETON: SkeletonGraph = {
  title: 'agent-observe-panorama',
  nodes: [
    { id: 'client', label: 'Client', x: 40, y: 80, w: 110, h: 48, fill: '#0f3d38', detail: 'Web/CLI input + render' },
    { id: 'admit', label: 'Host admit', x: 200, y: 80, w: 120, h: 48, fill: '#152a48', detail: 'SessionController' },
    { id: 'profile', label: 'Profile', x: 360, y: 40, w: 100, h: 40, fill: '#1a2740', detail: 'Boot composition' },
    { id: 'session', label: 'Session', x: 360, y: 100, w: 100, h: 40, fill: '#1c2f3a', detail: 'Durable log identity' },
    { id: 'envelope', label: 'Envelope', x: 500, y: 80, w: 110, h: 48, fill: '#243018', detail: 'request/header' },
    { id: 'context', label: 'Context', x: 650, y: 80, w: 110, h: 48, fill: '#1f2a3a', detail: 'Per-step LLM request' },
    { id: 'model', label: 'Model', x: 800, y: 40, w: 110, h: 48, fill: '#3a2a10', detail: 'LLM completion' },
    { id: 'tools', label: 'Tools', x: 800, y: 120, w: 110, h: 48, fill: '#3a1530', detail: 'Tool executions', shape: 'circle', type: 'tool' },
    { id: 'durable', label: 'Session write', x: 950, y: 80, w: 120, h: 48, fill: '#1c2f3a', detail: 'Append + surface' },
    { id: 'render', label: 'Client render', x: 1110, y: 80, w: 120, h: 48, fill: '#143528', detail: 'UI projection' },
    { id: 'preset', label: 'Preset / subagent', x: 500, y: 180, w: 140, h: 40, fill: '#1a2740', detail: 'Optional spur' },
  ],
  edges: [
    { from: 'client', to: 'admit', kind: 'data', label: 'session.prompt' },
    { from: 'admit', to: 'profile', kind: 'flow' },
    { from: 'admit', to: 'session', kind: 'flow' },
    { from: 'session', to: 'envelope', kind: 'data' },
    { from: 'envelope', to: 'context', kind: 'data' },
    { from: 'context', to: 'model', kind: 'data' },
    { from: 'model', to: 'tools', kind: 'flow' },
    { from: 'tools', to: 'model', kind: 'data' },
    { from: 'model', to: 'durable', kind: 'data' },
    { from: 'tools', to: 'durable', kind: 'data' },
    { from: 'durable', to: 'render', kind: 'data' },
    { from: 'profile', to: 'preset', kind: 'flow' },
  ],
  groups: [
    { id: 'g-client', label: 'Client', memberIds: ['client', 'render'], x: 20, y: 20, w: 1240, h: 220 },
  ],
}

/**
 * @param ctx - shared dimension context.
 * @returns panorama graph view.
 */
export function derivePanoramaDimension(ctx: FlowDimensionContext): GraphDimensionView {
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)
  const statusById = new Map<string, FlowNodeStatus>()
  statusById.set('client', statusFromSeen(evidence, evidence.hasUserInput, {
    activeWhenLive: !evidence.turnStarted,
  }))
  statusById.set('admit', statusFromSeen(evidence, evidence.turnStarted || evidence.hasUserInput, {
    activeWhenLive: evidence.turnStarted && !evidence.hasRequestHeader,
    errorWithTurn: true,
  }))
  statusById.set('profile', statusFromSeen(evidence, evidence.turnStarted))
  statusById.set('session', statusFromSeen(evidence, evidence.turnStarted, { errorWithTurn: true }))
  statusById.set('envelope', statusFromSeen(evidence, evidence.hasRequestHeader))
  statusById.set('context', statusFromSeen(evidence, evidence.hasRequestHeader || evidence.stepCount > 0, {
    activeWhenLive: evidence.openStep,
  }))
  const modelSeen = evidence.hasAssistant || evidence.stepCount > 0
  statusById.set('model', statusFromSeen(evidence, modelSeen, {
    activeWhenLive: evidence.openStep && !evidence.hasTool,
    errorWithTurn: true,
  }))
  statusById.set('tools', statusFromSeen(evidence, evidence.hasTool, {
    activeWhenLive: evidence.hasTool && evidence.openStep,
  }))
  statusById.set('durable', statusFromSeen(evidence, evidence.hasAssistant || evidence.hasTool || evidence.turnEnded, {
    errorWithTurn: true,
  }))
  statusById.set('render', statusFromSeen(evidence, evidence.hasRenderHint))
  statusById.set(
    'preset',
    evidence.agentPreset !== undefined ? statusFromSeen(evidence, true) : 'pending',
  )

  const inspectByNodeId = new Map<string, FlowNodeInspect>()
  if (evidence.turn !== null) {
    inspectByNodeId.set('model', {
      detail: evidence.stepCount > 0
        ? `Turn ${evidence.turn} · steps ${evidence.stepCount}${evidence.openStep ? ' (open)' : ''}`
        : `Turn ${evidence.turn}`,
    })
    if (evidence.toolNames.length > 0) {
      inspectByNodeId.set('tools', { detail: evidence.toolNames.join(', ') })
    }
    if (evidence.agentPreset !== undefined) {
      inspectByNodeId.set('preset', { detail: evidence.agentPreset })
    }
  }

  return {
    kind: 'graph',
    document: skeletonToDocument(PANORAMA_SKELETON, statusById),
    inspectByNodeId,
    blankDoubleClickToFleet: true,
    legend: 'status',
  }
}

/** Panorama dimension module. */
export const panoramaDimension: FlowDimensionModule = {
  id: 'panorama',
  labelKey: 'flow.dim.panorama',
  derive: derivePanoramaDimension,
}
