/**
 * DataFlow topology: Architecture E2E spine + real N×Step bands (Session-backed).
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { FlowNodeStatus } from '../../derive-flow.ts'
import { alarmsFromStatus } from '../../aitopo/alarms-from-status.ts'
import { DARK_FLOW_NODE_STYLE } from '../../aitopo/dark-node-style.ts'
import {
  flowEdgeStyle,
  DARK_FLOW_GROUP_STYLE,
  GROUP_OUTSIDE_LABEL_CLEARANCE,
  observeLayoutGroup,
} from '../../aitopo/flow-edge-style.ts'
import {
  durableEventsFromWindow,
  listEventsForTurn,
  statusFromSeen,
  collectTurnEvidence,
} from '../turn-evidence.ts'
import type { FlowDimensionContext } from '../types.ts'

const E2E_Y = 36
const E2E_H = 200
/** Leave room for outside topLeft labels between E2E and Steps bands. */
const STEPS_Y = E2E_Y + E2E_H + GROUP_OUTSIDE_LABEL_CLEARANCE
const STEP_GAP = GROUP_OUTSIDE_LABEL_CLEARANCE
/** Align Step bands with the E2E group width. */
const CANVAS_X = 20
const CANVAS_W = 1040
const STEP_PAD_Y = 28
const TRUNK_H = 48
const TRUNK_GAP = 48
const START_W = 110
const REQUEST_W = 140
const MODEL_W = 120
/** Horizontal slot after Model for the Tools group (no Tools hub node). */
const TOOLS_SLOT_W = 160
const END_W = 110
const TOOL_SIZE = 52
const TOOL_GAP_X = 68
const TOOL_GAP_Y = 72
const TOOLS_PER_ROW = 4

function trunkWidth(hasTools: boolean): number {
  const afterModel = hasTools
    ? TRUNK_GAP + TOOLS_SLOT_W + TRUNK_GAP + END_W
    : TRUNK_GAP + END_W
  return START_W + TRUNK_GAP + REQUEST_W + TRUNK_GAP + MODEL_W + afterModel
}

/** One tool branch inside a Step. */
export interface DataFlowToolRef {
  readonly callId: string
  readonly name: string
}

/** One real Step band derived from step/start…step/end. */
export interface DataFlowStepBand {
  readonly step: number
  readonly open: boolean
  readonly tools: readonly DataFlowToolRef[]
}

/** Graph build result before inspect projection. */
export interface DataFlowGraphBuild {
  readonly document: GraphDocument
  readonly steps: readonly DataFlowStepBand[]
  readonly turn: number | null
  readonly events: readonly SessionEvent[]
  readonly durable: readonly SessionEvent[]
}

/**
 * Build the DataFlow GraphDocument for the focused Turn.
 * @param ctx - shared dimension context.
 * @returns document plus step/event handles for inspect.
 */
export function buildDataFlowGraph(ctx: FlowDimensionContext): DataFlowGraphBuild {
  const showControl = ctx.showDataFlowControlEdges === true
  const durable = durableEventsFromWindow(ctx.window)
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)
  const turn = evidence.turn
  const events = listEventsForTurn(durable, turn)
  const steps = listStepBands(events)
  const t = ctx.t

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const groups: GraphGroup[] = []

  const e2eIds = {
    client: 'df:e2e:client',
    admit: 'df:e2e:admit',
    session: 'df:e2e:session',
    model: 'df:e2e:model',
    tools: 'df:e2e:tools',
    write: 'df:e2e:write',
    render: 'df:e2e:render',
  } as const

  pushNode(nodes, {
    id: e2eIds.client,
    label: t('flow.dataflow.node.client'),
    status: statusFromSeen(evidence, evidence.hasUserInput, {
      activeWhenLive: !evidence.turnStarted,
    }),
    x: 40,
    y: E2E_Y + 70,
    w: 120,
    h: 48,
    groupId: 'g-df-e2e',
    fill: '#0f3d38',
    detail: 'user input',
  })
  pushNode(nodes, {
    id: e2eIds.admit,
    label: t('flow.dataflow.node.admit'),
    status: statusFromSeen(evidence, evidence.turnStarted || evidence.hasUserInput, {
      activeWhenLive: evidence.turnStarted && !evidence.hasRequestHeader,
      errorWithTurn: true,
    }),
    x: 200,
    y: E2E_Y + 70,
    w: 120,
    h: 48,
    groupId: 'g-df-e2e',
    fill: '#152a48',
    detail: 'Host admit',
  })
  pushNode(nodes, {
    id: e2eIds.session,
    label: t('flow.dataflow.node.session'),
    status: statusFromSeen(evidence, evidence.turnStarted, { errorWithTurn: true }),
    x: 360,
    y: E2E_Y + 70,
    w: 110,
    h: 48,
    groupId: 'g-df-e2e',
    fill: '#1c2f3a',
    detail: 'Session log',
  })
  pushNode(nodes, {
    id: e2eIds.model,
    label: t('flow.dataflow.node.model'),
    status: statusFromSeen(evidence, evidence.hasAssistant || evidence.stepCount > 0, {
      activeWhenLive: evidence.openStep && !evidence.hasTool,
      errorWithTurn: true,
    }),
    x: 520,
    y: E2E_Y + 40,
    w: 120,
    h: 48,
    groupId: 'g-df-e2e',
    fill: '#3a2a10',
    detail: 'Model hub',
  })
  pushNode(nodes, {
    id: e2eIds.tools,
    label: t('flow.dataflow.node.tools'),
    status: statusFromSeen(evidence, evidence.hasTool, {
      activeWhenLive: evidence.hasTool && evidence.openStep,
    }),
    x: 575,
    y: E2E_Y + 120,
    w: 56,
    h: 56,
    groupId: 'g-df-e2e',
    fill: '#3a1530',
    detail: 'Tools',
    shape: 'circle',
    type: 'tool',
  })
  pushNode(nodes, {
    id: e2eIds.write,
    label: t('flow.dataflow.node.write'),
    status: statusFromSeen(evidence, evidence.hasAssistant || evidence.hasTool || evidence.turnEnded, {
      errorWithTurn: true,
    }),
    x: 700,
    y: E2E_Y + 70,
    w: 130,
    h: 48,
    groupId: 'g-df-e2e',
    fill: '#1c2f3a',
    detail: 'Session write',
  })
  pushNode(nodes, {
    id: e2eIds.render,
    label: t('flow.dataflow.node.render'),
    status: statusFromSeen(evidence, evidence.hasRenderHint),
    x: 880,
    y: E2E_Y + 70,
    w: 130,
    h: 48,
    groupId: 'g-df-e2e',
    fill: '#143528',
    detail: 'Client UI',
  })

  pushEdge(edges, e2eIds.client, e2eIds.admit, 'data', 'session.prompt')
  pushEdge(edges, e2eIds.admit, e2eIds.session, 'data', 'turn')
  pushEdge(edges, e2eIds.session, e2eIds.model, 'data', 'context')
  pushEdge(edges, e2eIds.model, e2eIds.tools, 'data', 'tool.args')
  pushEdge(edges, e2eIds.tools, e2eIds.model, 'data', 'tool.result')
  pushEdge(edges, e2eIds.model, e2eIds.write, 'data', 'assistant')
  pushEdge(edges, e2eIds.tools, e2eIds.write, 'data', 'tool.result')
  pushEdge(edges, e2eIds.write, e2eIds.render, 'data', 'session.follow')

  groups.push(observeLayoutGroup({
    id: 'g-df-e2e',
    label: t('flow.dataflow.group.e2e'),
    memberIds: Object.values(e2eIds),
    x: 20,
    y: 12,
    w: 1040,
    h: E2E_H,
    style: DARK_FLOW_GROUP_STYLE,
  }))

  const turnStartId = 'df:turn:start'
  const turnEndId = 'df:turn:end'
  const stepMemberIds: string[] = []

  if (evidence.turnStarted || steps.length > 0) {
    pushNode(nodes, {
      id: turnStartId,
      label: 'turn/start',
      status: statusFromSeen(evidence, evidence.turnStarted, {
        activeWhenLive: evidence.turnStarted && evidence.stepCount === 0,
        errorWithTurn: true,
      }),
      x: 40,
      y: STEPS_Y + 70,
      w: 120,
      h: 44,
      groupId: 'g-df-steps',
      fill: '#152a48',
    })
    stepMemberIds.push(turnStartId)
    pushEdge(edges, e2eIds.admit, turnStartId, 'flow', 'enter turn')
  }

  let previousStepEndId: string | undefined
  let lastStepModelId: string | undefined
  let bandY = STEPS_Y + 40
  let lastBandBottom = bandY

  for (let index = 0; index < steps.length; index++) {
    const band = steps[index]!
    const step = band.step
    const hasTools = band.tools.length > 0
    const metrics = stepBandMetrics(band.tools.length)
    const groupId = `g-df-step-${step}`
    const toolsGroupId = `g-df-s${step}-tools`
    const startId = `df:s${step}:start`
    const requestId = `df:s${step}:request`
    const modelId = `df:s${step}:model`
    const endId = `df:s${step}:end`
    const memberIds = [startId, requestId, modelId, endId]
    const toolMemberIds: string[] = []

    const stepEnded = !band.open
    const stepActive = band.open && evidence.live

    const width = trunkWidth(hasTools)
    const trunkStartX = CANVAS_X + (CANVAS_W - width) / 2
    const trunkTop = bandY + STEP_PAD_Y + metrics.aboveRows * TOOL_GAP_Y
    const trunkCenterY = trunkTop + TRUNK_H / 2
    const startX = trunkStartX
    const requestX = startX + START_W + TRUNK_GAP
    const modelX = requestX + REQUEST_W + TRUNK_GAP
    const toolsSlotX = modelX + MODEL_W + TRUNK_GAP
    const endX = hasTools
      ? toolsSlotX + TOOLS_SLOT_W + TRUNK_GAP
      : modelX + MODEL_W + TRUNK_GAP
    const toolsAnchorX = toolsSlotX + TOOLS_SLOT_W / 2

    pushNode(nodes, {
      id: startId,
      label: 'step/start',
      status: stepEnded || stepActive ? (stepActive ? 'active' : 'done') : 'pending',
      x: startX,
      y: trunkCenterY - 20,
      w: START_W,
      h: 40,
      groupId,
      fill: '#1f2a3a',
    })
    pushNode(nodes, {
      id: requestId,
      label: t('flow.dataflow.node.request'),
      status: stepRequestStatus(events, step, stepActive),
      x: requestX,
      y: trunkCenterY - 20,
      w: REQUEST_W,
      h: 40,
      groupId,
      fill: '#243018',
      detail: `step ${step} request`,
    })
    pushNode(nodes, {
      id: modelId,
      label: t('flow.dataflow.node.model'),
      status: stepStatus(events, step, 'model', stepActive, evidence.turnError),
      x: modelX,
      y: trunkCenterY - 22,
      w: MODEL_W,
      h: 44,
      groupId,
      fill: '#3a2a10',
      detail: `step ${step} model`,
    })
    lastStepModelId = modelId

    const toolLayouts = layoutToolsAroundTrunk(band.tools, toolsAnchorX, trunkCenterY)
    for (const placed of toolLayouts) {
      const toolId = `df:s${step}:tool:${placed.tool.callId}`
      toolMemberIds.push(toolId)
      memberIds.push(toolId)
      pushNode(nodes, {
        id: toolId,
        label: placed.tool.name,
        status: toolStatus(events, placed.tool.callId, stepActive),
        x: placed.cx,
        y: placed.cy,
        w: TOOL_SIZE,
        h: TOOL_SIZE,
        groupId: toolsGroupId,
        fill: '#3a1530',
        shape: 'circle',
        type: 'tool',
        detail: placed.tool.callId,
      })
      // Model dispatches tool args; results rejoin the Step trunk then feed Session / next Step.
      pushEdge(edges, modelId, toolId, 'data', 'tool.args')
      pushEdge(edges, toolId, endId, 'data', 'tool.result')
      pushEdge(edges, toolId, e2eIds.write, 'data', 'surface')
    }

    pushNode(nodes, {
      id: endId,
      label: 'step/end',
      status: stepEnded ? 'done' : (stepActive ? 'active' : 'pending'),
      x: endX,
      y: trunkCenterY - 20,
      w: END_W,
      h: 40,
      groupId,
      fill: '#1f2a3a',
    })

    pushEdge(edges, startId, requestId, 'flow')
    pushEdge(edges, requestId, modelId, 'data', 'header')
    if (hasTools) {
      // Trunk continues through the Tools group slot (no Tools hub node).
      pushEdge(edges, modelId, endId, 'flow', 'via tools')
    } else {
      pushEdge(edges, modelId, endId, 'flow')
    }

    if (index === 0 && stepMemberIds.includes(turnStartId)) {
      pushEdge(edges, turnStartId, startId, 'flow')
    }
    if (previousStepEndId !== undefined) {
      pushEdge(edges, previousStepEndId, startId, 'flow', 'next step')
    }

    // Tool / assistant surface from this Step organizes into the next Step request.
    const next = steps[index + 1]
    if (next !== undefined) {
      const nextRequestId = `df:s${next.step}:request`
      pushEdge(edges, endId, nextRequestId, 'data', 'surface → next')
      for (const toolId of toolMemberIds) {
        pushEdge(edges, toolId, nextRequestId, 'data', 'tool.result → next')
      }
      if (toolMemberIds.length === 0) {
        pushEdge(edges, modelId, nextRequestId, 'data', 'assistant → next')
      }
    }

    previousStepEndId = endId

    if (hasTools) {
      const toolsGroupH = Math.max(
        TRUNK_H + 24,
        metrics.aboveRows * TOOL_GAP_Y + TRUNK_H + metrics.belowRows * TOOL_GAP_Y,
      )
      groups.push(observeLayoutGroup({
        id: toolsGroupId,
        label: t('flow.dataflow.group.tools'),
        memberIds: toolMemberIds,
        x: toolsSlotX - 12,
        y: trunkCenterY - toolsGroupH / 2,
        w: TOOLS_SLOT_W + 24,
        h: toolsGroupH,
        style: DARK_FLOW_GROUP_STYLE,
      }))
    }

    groups.push(observeLayoutGroup({
      id: groupId,
      label: t('flow.dataflow.group.step', { step: String(step) }),
      memberIds,
      x: CANVAS_X,
      y: bandY,
      w: CANVAS_W,
      h: metrics.height,
      style: DARK_FLOW_GROUP_STYLE,
    }))
    stepMemberIds.push(...memberIds)

    pushEdge(edges, e2eIds.model, modelId, 'flow', 'same stage')
    if (toolMemberIds[0] !== undefined) {
      pushEdge(edges, e2eIds.tools, toolMemberIds[0], 'flow', 'same stage')
    }

    lastBandBottom = bandY + metrics.height
    bandY = lastBandBottom + STEP_GAP
  }

  if (evidence.turnStarted || evidence.turnEnded || steps.length > 0) {
    const endY = steps.length > 0
      ? lastBandBottom + GROUP_OUTSIDE_LABEL_CLEARANCE
      : STEPS_Y + 70
    pushNode(nodes, {
      id: turnEndId,
      label: 'turn/end',
      status: statusFromSeen(evidence, evidence.turnEnded, { errorWithTurn: true }),
      x: 40,
      y: endY,
      w: 120,
      h: 44,
      groupId: 'g-df-steps',
      fill: '#152a48',
    })
    stepMemberIds.push(turnEndId)
    if (previousStepEndId !== undefined) {
      pushEdge(edges, previousStepEndId, turnEndId, 'flow')
    } else if (stepMemberIds.includes(turnStartId)) {
      pushEdge(edges, turnStartId, turnEndId, 'flow')
    }
    pushEdge(edges, turnEndId, e2eIds.write, 'data', 'settle')
    lastBandBottom = endY + 44
  }

  if (lastStepModelId !== undefined) {
    pushEdge(edges, lastStepModelId, e2eIds.write, 'data', 'assistant')
  }

  const stepsHeight = Math.max(160, lastBandBottom - (STEPS_Y - 16) + 24)
  if (stepMemberIds.length > 0) {
    groups.push(observeLayoutGroup({
      id: 'g-df-steps',
      label: t('flow.dataflow.group.steps'),
      memberIds: stepMemberIds,
      x: CANVAS_X,
      y: STEPS_Y - 16,
      w: CANVAS_W,
      h: stepsHeight,
      style: DARK_FLOW_GROUP_STYLE,
    }))
  }

  const filteredEdges = showControl
    ? edges
    : edges.filter(edge => edge.kind === 'data' || isStepOrTurnEdge(edge))

  return {
    document: {
      version: 1,
      meta: { kind: 'flow', title: 'agent-observe-dataflow' },
      nodes,
      edges: filteredEdges.map(emphasizeDataEdge),
      groups,
    },
    steps,
    turn,
    events,
    durable,
  }
}

/** Vertical space and tool-row counts for one Step band. */
function stepBandMetrics(toolCount: number): {
  readonly height: number
  readonly aboveRows: number
  readonly belowRows: number
} {
  const aboveCount = Math.ceil(toolCount / 2)
  const belowCount = Math.floor(toolCount / 2)
  const aboveRows = aboveCount === 0 ? 0 : Math.ceil(aboveCount / TOOLS_PER_ROW)
  const belowRows = belowCount === 0 ? 0 : Math.ceil(belowCount / TOOLS_PER_ROW)
  const height = Math.max(
    140,
    STEP_PAD_Y
      + aboveRows * TOOL_GAP_Y
      + TRUNK_H
      + belowRows * TOOL_GAP_Y
      + STEP_PAD_Y,
  )
  return { height, aboveRows, belowRows }
}

/**
 * Place tools above/below the Tools-group anchor (trunk slot after Model).
 * Even indices go above; odd indices go below.
 */
function layoutToolsAroundTrunk(
  tools: readonly DataFlowToolRef[],
  toolsAnchorX: number,
  trunkCenterY: number,
): readonly { tool: DataFlowToolRef, cx: number, cy: number }[] {
  const above: DataFlowToolRef[] = []
  const below: DataFlowToolRef[] = []
  for (let i = 0; i < tools.length; i++) {
    if (i % 2 === 0) above.push(tools[i]!)
    else below.push(tools[i]!)
  }
  return [
    ...placeToolSide(above, toolsAnchorX, trunkCenterY, 'above'),
    ...placeToolSide(below, toolsAnchorX, trunkCenterY, 'below'),
  ]
}

function placeToolSide(
  sideTools: readonly DataFlowToolRef[],
  modelCenterX: number,
  trunkCenterY: number,
  side: 'above' | 'below',
): readonly { tool: DataFlowToolRef, cx: number, cy: number }[] {
  const placed: { tool: DataFlowToolRef, cx: number, cy: number }[] = []
  for (let i = 0; i < sideTools.length; i++) {
    const row = Math.floor(i / TOOLS_PER_ROW)
    const col = i % TOOLS_PER_ROW
    const rowStart = row * TOOLS_PER_ROW
    const rowCount = Math.min(TOOLS_PER_ROW, sideTools.length - rowStart)
    const rowWidth = (rowCount - 1) * TOOL_GAP_X
    const cx = modelCenterX - rowWidth / 2 + col * TOOL_GAP_X
    const cy = side === 'above'
      ? trunkCenterY - TOOL_GAP_Y - row * TOOL_GAP_Y
      : trunkCenterY + TOOL_GAP_Y + row * TOOL_GAP_Y
    placed.push({ tool: sideTools[i]!, cx, cy })
  }
  return placed
}

function listStepBands(events: readonly SessionEvent[]): DataFlowStepBand[] {
  const starts = events
    .filter((e): e is Extract<SessionEvent, { type: 'step/start' }> => e.type === 'step/start')
    .map(e => e.data.step)
  const unique = [...new Set(starts)].sort((a, b) => a - b)
  return unique.map(step => {
    const ended = events.some(e => e.type === 'step/end' && e.data.step === step)
    const tools = listToolsForStep(events, step)
    return { step, open: !ended, tools }
  })
}

function listToolsForStep(events: readonly SessionEvent[], step: number): DataFlowToolRef[] {
  const tools: DataFlowToolRef[] = []
  const seen = new Set<string>()
  for (const event of events) {
    if (event.type !== 'tool/call') continue
    if (event.data.step !== step) continue
    if (seen.has(event.data.callId)) continue
    seen.add(event.data.callId)
    tools.push({ callId: event.data.callId, name: event.data.name })
  }
  return tools
}

function stepRequestStatus(
  events: readonly SessionEvent[],
  step: number,
  stepActive: boolean,
): FlowNodeStatus {
  const inStep = eventsInStepWindow(events, step)
  const hasHeader = inStep.some(e => e.type === 'request/header')
  if (hasHeader) return 'done'
  if (stepActive) return 'active'
  return 'pending'
}

function stepStatus(
  events: readonly SessionEvent[],
  step: number,
  _kind: 'model',
  stepActive: boolean,
  turnError: boolean,
): FlowNodeStatus {
  const inStep = eventsInStepWindow(events, step)
  const hasAssistant = inStep.some(e => e.type === 'assistant/message')
  if (turnError && hasAssistant) return 'error'
  if (hasAssistant) return 'done'
  if (stepActive) return 'active'
  return 'pending'
}

function eventsInStepWindow(events: readonly SessionEvent[], step: number): SessionEvent[] {
  const start = events.find(e => e.type === 'step/start' && e.data.step === step)
  const end = events.find(e => e.type === 'step/end' && e.data.step === step)
  if (start === undefined) {
    return events.filter(e => eventStep(e) === step)
  }
  return events.filter(event => {
    if (event.seq < start.seq) return false
    if (end !== undefined && event.seq > end.seq) return false
    return true
  })
}

function toolStatus(
  events: readonly SessionEvent[],
  callId: string,
  stepActive: boolean,
): FlowNodeStatus {
  const hasResult = events.some(e => toolResultCallId(e) === callId)
  if (hasResult) return 'done'
  if (stepActive) return 'active'
  return 'pending'
}

function eventStep(event: SessionEvent): number | undefined {
  const data = event.data as { step?: number }
  return typeof data.step === 'number' ? data.step : undefined
}

/** Resolve tool/result → callId (Session message form or legacy). */
export function toolResultCallId(event: SessionEvent): string | undefined {
  if (event.type !== 'tool/result') return undefined
  const data = event.data as {
    callId?: string
    message?: { content: readonly { type: string, toolCallId?: string }[] }
  }
  if (typeof data.callId === 'string') return data.callId
  const block = data.message?.content.find(part => part.type === 'tool-result')
  return block?.toolCallId
}

function pushNode(nodes: GraphNode[], spec: {
  id: string
  label: string
  status: FlowNodeStatus
  x: number
  y: number
  w: number
  h: number
  groupId: string
  fill?: string
  detail?: string
  shape?: 'circle'
  type?: string
}): void {
  const radius = spec.shape === 'circle' ? Math.min(spec.w, spec.h) / 2 : undefined
  const circle = spec.shape === 'circle' && radius !== undefined
  const alarms = alarmsFromStatus(spec.status, spec.id, spec.detail)
  nodes.push({
    id: spec.id,
    type: spec.type ?? 'stage',
    label: spec.label,
    status: spec.status,
    x: circle ? spec.x - radius! : spec.x,
    y: circle ? spec.y - radius! : spec.y,
    w: circle ? radius! * 2 : spec.w,
    h: circle ? radius! * 2 : spec.h,
    groupId: spec.groupId,
    style: DARK_FLOW_NODE_STYLE,
    ...(alarms === undefined ? {} : { alarms }),
    data: {
      meta: spec.detail ?? spec.type ?? 'stage',
      ...(spec.fill === undefined ? {} : { fill: spec.fill }),
      ...(spec.shape === undefined ? {} : { shape: spec.shape }),
    },
  })
}

function pushEdge(
  edges: GraphEdge[],
  from: string,
  to: string,
  kind: 'flow' | 'data',
  label?: string,
): void {
  edges.push({
    id: `${from}->${to}${label === undefined ? '' : `:${label}`}`,
    from,
    to,
    kind,
    ...(label === undefined ? {} : { label }),
    style: flowEdgeStyle({
      kind,
      stroke: kind === 'data' ? '#2dd4bf' : '#5a6478',
      strokeHover: kind === 'data' ? '#5eead4' : '#3b82f6',
      lineWidth: kind === 'data' ? 1.4 : 1.0,
      alpha: kind === 'flow' ? 0.35 : 1,
    }),
  })
}

function isStepOrTurnEdge(edge: GraphEdge): boolean {
  const stepOrTurn = (id: string): boolean =>
    id.startsWith('df:s') || id.startsWith('df:turn:')
  return stepOrTurn(edge.from) && stepOrTurn(edge.to)
}

function emphasizeDataEdge(edge: GraphEdge): GraphEdge {
  if (edge.kind !== 'data') {
    return {
      ...edge,
      style: flowEdgeStyle({
        kind: 'flow',
        stroke: '#5a6478',
        strokeHover: '#3b82f6',
        lineWidth: 1.0,
        alpha: 0.35,
      }),
    }
  }
  return {
    ...edge,
    style: flowEdgeStyle({
      kind: 'data',
      stroke: '#2dd4bf',
      strokeHover: '#5eead4',
      lineWidth: 1.4,
    }),
  }
}
