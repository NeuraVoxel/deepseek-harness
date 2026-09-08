/**
 * Agent turn/step/tool flow graph derived from a Client Session event window.
 *
 * Harness frame nodes (Profile / Session / Envelope) sit in the prelude.
 * Per-step Memory + Context feed the existing Step → Model → Tools pipeline.
 */

import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Lifecycle of one flow node on the Agent process canvas. */
export type FlowNodeStatus = 'pending' | 'active' | 'done' | 'error'

/**
 * Kind of pipeline stage.
 *
 * Harness frame: `profile`, `session`, `envelope` (`request/header` + preset).
 * LLM assembly: `memory` (Session surface + compaction), `context` (request envelope + injections).
 * Loop: `client-input` … `client-render`.
 */
export type FlowNodeKind =
  | 'profile'
  | 'session'
  | 'envelope'
  | 'memory'
  | 'context'
  | 'client-input'
  | 'host-admit'
  | 'step'
  | 'model'
  | 'tool'
  | 'join'
  | 'turn-end'
  | 'client-render'

/** One node in the Harness → Loop → Client pipeline. */
export interface AgentFlowNode {
  readonly id: string
  readonly kind: FlowNodeKind
  readonly label: string
  readonly detail?: string
  /** Full input payload for selection inspection. */
  readonly inputText: string
  /** Full output payload for selection inspection. */
  readonly outputText: string
  readonly status: FlowNodeStatus
  readonly turn: number
  /** Owning step; absent for prelude / epilogue nodes. */
  readonly step?: number
  readonly callId?: string
}

/** Directed edge between flow nodes. */
export interface AgentFlowEdge {
  readonly from: string
  readonly to: string
  /** `flow` = control / step pipeline; `data` = payload feed into Context. */
  readonly kind: 'flow' | 'data'
}

/** Flow snapshot for one Agent Session (latest turn focus). */
export interface AgentFlowSnapshot {
  readonly turn: number | null
  readonly nodes: readonly AgentFlowNode[]
  readonly edges: readonly AgentFlowEdge[]
  readonly running: boolean
  readonly updatedAt: string
}

const EMPTY: AgentFlowSnapshot = {
  turn: null,
  nodes: [],
  edges: [],
  running: false,
  updatedAt: new Date(0).toISOString(),
}

const IO_MAX = 4_000

/**
 * @returns empty flow snapshot.
 */
export function emptyAgentFlow(): AgentFlowSnapshot {
  return EMPTY
}

/**
 * Fold the event window into a process topology for the latest turn.
 * @param window - Session event window from the Client binding.
 * @param session - Session lifecycle snapshot (running / pending).
 * @returns flow graph with active highlights.
 */
export function deriveAgentFlow(
  window: SessionEventWindow,
  session: SessionSnapshot,
): AgentFlowSnapshot {
  const durable: SessionEvent[] = []
  for (const entry of window.entries) {
    if (entry.type === 'event') durable.push(entry.event)
  }

  const latestTurn = findLatestTurn(durable)
  if (latestTurn === null) {
    return deriveEngagingFlow(session)
  }

  // user/message and some injections carry no turn field — scope by turn/start…turn/end seq range.
  const inTurn = eventsInTurn(durable, latestTurn)
  const nodes: AgentFlowNode[] = []
  const edges: AgentFlowEdge[] = []
  const add = (node: AgentFlowNode): void => { nodes.push(node) }
  const link = (from: string, to: string, kind: AgentFlowEdge['kind'] = 'flow'): void => {
    edges.push({ from, to, kind })
  }

  const turnEnded = inTurn.some(e => e.type === 'turn/end')
  const turnError = inTurn.find(e => e.type === 'turn/end'
    && (e.data.reason.kind === 'error' || e.data.reason.kind === 'aborted'))
  const frameStatus: FlowNodeStatus = turnEnded
    ? (turnError ? 'error' : 'done')
    : session.running ? 'active' : 'done'

  const { sessionId, envelopeId } = addHarnessFrame({
    add,
    link,
    session,
    durable,
    inTurn,
    turn: latestTurn,
    status: frameStatus,
  })

  const inputs = inTurn.filter(isUserPromptMessage)
  const inputIds: string[] = []
  let aggregatedInput = ''
  if (inputs.length === 0 && session.pendingSubmissions.length > 0) {
    const pending = session.pendingSubmissions[session.pendingSubmissions.length - 1]!
    const id = `input:pending:${pending.requestId}`
    inputIds.push(id)
    aggregatedInput = pending.text
    add({
      id,
      kind: 'client-input',
      label: 'Client input',
      detail: truncate(pending.text, 48) || '(attachment)',
      inputText: clipIo(pending.text || '(attachment)'),
      outputText: clipIo('Queued for Host admit'),
      status: 'active',
      turn: latestTurn,
    })
  } else {
    inputs.forEach((event, index) => {
      if (event.type !== 'user/message') return
      const id = `input:${event.seq}`
      inputIds.push(id)
      const full = fullContent(event.data.content)
      aggregatedInput = aggregatedInput ? `${aggregatedInput}\n---\n${full}` : full
      add({
        id,
        kind: 'client-input',
        label: index === 0 ? 'Client input' : `Input ${index + 1}`,
        detail: previewContent(event.data.content),
        inputText: clipIo(full),
        outputText: clipIo(`Delivered to Host (seq ${event.seq})`),
        status: 'done',
        turn: latestTurn,
      })
    })
  }

  const admitId = `admit:${latestTurn}`
  add({
    id: admitId,
    kind: 'host-admit',
    label: `Turn ${latestTurn}`,
    detail: 'Host admit',
    inputText: clipIo(aggregatedInput || '(no user message yet)'),
    outputText: clipIo(turnEnded
      ? `Turn ${latestTurn} closed`
      : `Turn ${latestTurn} open · running=${session.running}`),
    status: frameStatus,
    turn: latestTurn,
  })
  for (const inputId of inputIds) {
    link(sessionId, inputId)
    link(inputId, admitId)
  }
  if (inputIds.length === 0) link(sessionId, admitId)

  let previousAnchor = admitId
  const stepStarts = inTurn.filter(e => e.type === 'step/start')
  const stepNumbers = [...new Set(stepStarts.map(e => e.type === 'step/start' ? e.data.step : 0))]
    .sort((a, b) => a - b)

  if (stepNumbers.length === 0 && !turnEnded) {
    const pending = addStepAssembly({
      add,
      link,
      turn: latestTurn,
      step: 0,
      stepKey: 'pending',
      envelopeId,
      previousAnchor,
      session,
      durable,
      stepEvents: inTurn,
      stepEnded: false,
      pendingStep: true,
    })
    previousAnchor = pending.previousAnchor
  }

  for (const step of stepNumbers) {
    const stepEvents = eventsInStep(inTurn, step)
    const stepEnded = stepEvents.some(e => e.type === 'step/end')
    const assembled = addStepAssembly({
      add,
      link,
      turn: latestTurn,
      step,
      stepKey: String(step),
      envelopeId,
      previousAnchor,
      session,
      durable,
      stepEvents,
      stepEnded,
      pendingStep: false,
    })
    previousAnchor = assembled.previousAnchor

    const assistants = stepEvents.filter(e => e.type === 'assistant/message')
    const modelId = `model:${latestTurn}:${step}`
    const hasAssistant = assistants.length > 0
    const streaming = session.running && !stepEnded && !hasAssistant
    const lastAssistant = assistants[assistants.length - 1]
    const toolCallsFromAssistant = lastAssistant?.type === 'assistant/message'
      ? contentToolCalls(lastAssistant.data.message.content)
      : []
    const assistantFull = lastAssistant?.type === 'assistant/message'
      ? fullContent(lastAssistant.data.message.content)
      : ''
    const header = stepEvents.find(e => e.type === 'request/header')
    const requestSummary = header?.type === 'request/header'
      ? `request/header · reason=${header.data.reason}`
      : 'Model request (assembled from Session log)'

    add({
      id: modelId,
      kind: 'model',
      label: 'Model',
      detail: streaming ? 'Streaming…'
        : hasAssistant ? previewAssistant(lastAssistant!) : 'Request',
      inputText: clipIo(requestSummary),
      outputText: clipIo(streaming ? '(streaming…)' : assistantFull || '(no assistant message)'),
      status: streaming ? 'active' : hasAssistant || stepEnded ? 'done' : session.running ? 'active' : 'pending',
      turn: latestTurn,
      step,
    })
    link(assembled.stepId, modelId)

    const toolEvents = stepEvents.filter(e => e.type === 'tool/call' || e.type === 'tool/result')
    const calls = new Map<string, {
      name: string
      args?: string
      result?: string
      callSeq?: number
      resultSeq?: number
      error?: boolean
    }>()
    for (const event of toolEvents) {
      if (event.type === 'tool/call') {
        const prev = calls.get(event.data.callId) ?? { name: event.data.name }
        calls.set(event.data.callId, {
          ...prev,
          name: event.data.name,
          args: event.data.arguments,
          callSeq: event.seq,
        })
      } else if (event.type === 'tool/result') {
        const block = event.data.message.content.find(part => part.type === 'tool-result')
        if (block === undefined || block.type !== 'tool-result') continue
        const callId = block.toolCallId
        const prev = calls.get(callId) ?? { name: callId }
        calls.set(callId, {
          ...prev,
          resultSeq: event.seq,
          result: fullContent(block.content),
          error: block.isError === true,
        })
      }
    }
    for (const call of toolCallsFromAssistant) {
      if (!calls.has(call.id)) {
        const fromAssistant = lastAssistant?.type === 'assistant/message'
          ? lastAssistant.data.message.content.find(b => b.type === 'tool-call' && b.id === call.id)
          : undefined
        const args = fromAssistant && fromAssistant.type === 'tool-call'
          ? fromAssistant.arguments
          : undefined
        calls.set(call.id, args === undefined
          ? { name: call.name }
          : { name: call.name, args })
      }
    }

    const toolIds: string[] = []
    for (const [callId, info] of calls) {
      const id = `tool:${callId}`
      toolIds.push(id)
      const done = info.resultSeq !== undefined
      add({
        id,
        kind: 'tool',
        label: info.name,
        detail: done ? (info.error ? 'Error' : 'Result') : 'Running',
        inputText: clipIo(info.args ?? '(no arguments captured)'),
        outputText: clipIo(info.result ?? (done ? '(empty result)' : '(running…)')),
        status: done ? (info.error ? 'error' : 'done') : session.running ? 'active' : 'pending',
        turn: latestTurn,
        step,
        callId,
      })
      link(modelId, id)
    }

    previousAnchor = toolIds.length > 0 ? toolIds[toolIds.length - 1]! : modelId
    if (toolIds.length > 1) {
      const joinId = `join:${latestTurn}:${step}`
      add({
        id: joinId,
        kind: 'join',
        label: 'Join',
        detail: `${toolIds.length} parallel tools`,
        inputText: clipIo(`${toolIds.length} parallel tool branches`),
        outputText: clipIo('Continue to next step / turn end'),
        status: toolIds.every(id => nodes.find(n => n.id === id)?.status === 'done'
          || nodes.find(n => n.id === id)?.status === 'error')
          ? 'done'
          : session.running ? 'active' : 'pending',
        turn: latestTurn,
        step,
      })
      for (const toolId of toolIds) link(toolId, joinId)
      previousAnchor = joinId
    }
  }

  const endId = `turn-end:${latestTurn}`
  const endReason = turnError?.type === 'turn/end' ? turnError.data.reason.kind
    : turnEnded ? 'completed' : session.running ? 'in-progress' : 'open'
  add({
    id: endId,
    kind: 'turn-end',
    label: 'Turn end',
    detail: String(endReason),
    inputText: clipIo(`Turn ${latestTurn} settlement`),
    outputText: clipIo(`reason=${endReason}`),
    status: turnError ? 'error' : turnEnded ? 'done' : session.running ? 'active' : 'pending',
    turn: latestTurn,
  })
  link(previousAnchor, endId)

  const renderId = `client-render:${latestTurn}`
  add({
    id: renderId,
    kind: 'client-render',
    label: 'Client render',
    detail: turnEnded ? 'Settled' : 'Live UI',
    inputText: clipIo('Assistant / tool results from Session log'),
    outputText: clipIo(turnEnded ? 'UI settled' : 'Live stream / cards'),
    status: turnEnded ? 'done' : session.running ? 'active' : 'done',
    turn: latestTurn,
  })
  link(endId, renderId)

  return {
    turn: latestTurn,
    nodes,
    edges,
    running: session.running,
    updatedAt: new Date().toISOString(),
  }
}

function addHarnessFrame(args: {
  add: (node: AgentFlowNode) => void
  link: (from: string, to: string, kind?: AgentFlowEdge['kind']) => void
  session: SessionSnapshot
  durable: readonly SessionEvent[]
  inTurn: readonly SessionEvent[]
  turn: number
  status: FlowNodeStatus
}): { profileId: string; sessionId: string; envelopeId: string } {
  const { add, link, session, durable, inTurn, turn, status } = args
  const profileId = `profile:${session.sessionId}`
  const sessionNodeId = `session:${session.sessionId}`
  const envelopeId = `envelope:${turn}`

  add({
    id: profileId,
    kind: 'profile',
    label: 'Profile',
    detail: 'boot composition',
    inputText: clipIo('dsh --profile bundles + patches (Client cannot read Host profile name)'),
    outputText: clipIo('Registries: tools, systemPrompt, skills, settings, credentials, loop'),
    status: status === 'pending' ? 'pending' : 'done',
    turn,
  })

  add({
    id: sessionNodeId,
    kind: 'session',
    label: 'Session',
    detail: truncate(String(session.sessionId), 36),
    inputText: clipIo(`sessionId=${session.sessionId}`),
    outputText: clipIo([
      `blank=${session.blank}`,
      `running=${session.running}`,
      `awaitingFirstTurn=${session.awaitingFirstTurn}`,
    ].join('\n')),
    status,
    turn,
  })
  link(profileId, sessionNodeId)

  const preset = readAgentPreset(durable)
  const header = latestRequestHeader(inTurn) ?? latestRequestHeader(durable)
  const toolNames = header?.type === 'request/header'
    ? (header.data.header.tools ?? []).map(tool => tool.name)
    : []
  const systemPreview = header?.type === 'request/header' && typeof header.data.header.system === 'string'
    ? header.data.header.system
    : ''
  const model = header?.type === 'request/header'
    ? `${header.data.header.config.provider}/${header.data.header.config.model}`
    : undefined
  const envelopeParts = [
    preset === undefined ? undefined : `preset=${preset}`,
    toolNames.length > 0 ? `tools=${toolNames.length}` : undefined,
    model === undefined ? undefined : `model=${model}`,
  ].filter((part): part is string => part !== undefined)
  const hasEnvelopeEvidence = header !== undefined || preset !== undefined
  add({
    id: envelopeId,
    kind: 'envelope',
    label: 'Envelope',
    detail: envelopeParts.length > 0 ? envelopeParts.join(' · ') : 'awaiting request/header',
    inputText: clipIo([
      'request/header EpochHeader (system + tools + call config) + agentPreset:',
      preset === undefined ? 'agentPreset=(unknown)' : `agentPreset=${preset}`,
      toolNames.length > 0 ? `tools: ${toolNames.join(', ')}` : 'tools: (none logged yet)',
      model === undefined ? 'model: (none logged yet)' : `model: ${model}`,
    ].join('\n')),
    outputText: clipIo(systemPreview
      ? `system prompt (${systemPreview.length} chars)\n${systemPreview}`
      : '(no request/header system yet — logged at first step assembly)'),
    status: hasEnvelopeEvidence ? 'done' : session.running ? 'active' : 'pending',
    turn,
  })
  link(sessionNodeId, envelopeId)

  return { profileId, sessionId: sessionNodeId, envelopeId }
}

function addStepAssembly(args: {
  add: (node: AgentFlowNode) => void
  link: (from: string, to: string, kind?: AgentFlowEdge['kind']) => void
  turn: number
  step: number
  stepKey: string
  envelopeId: string
  previousAnchor: string
  session: SessionSnapshot
  durable: readonly SessionEvent[]
  stepEvents: readonly SessionEvent[]
  stepEnded: boolean
  pendingStep: boolean
}): { previousAnchor: string; stepId: string; contextId: string } {
  const {
    add, link, turn, step, stepKey, envelopeId, previousAnchor, session,
    durable, stepEvents, stepEnded, pendingStep,
  } = args
  const stepOpt = pendingStep ? undefined : step
  const memoryId = `memory:${turn}:${stepKey}`
  const contextId = `context:${turn}:${stepKey}`
  const stepId = pendingStep ? `step:${turn}:pending` : `step:${turn}:${step}`

  const surfaceBefore = countSurfaceMessages(durable, turn, pendingStep ? undefined : step)
  const compaction = findCompaction(durable, turn, pendingStep ? undefined : step)
  const memoryDetail = compaction === undefined
    ? `Session surface · ${surfaceBefore} msg`
    : `compaction · Session surface · ${surfaceBefore} msg`
  const memoryActive = session.running && !stepEnded && compaction !== undefined && compaction.open
  add({
    id: memoryId,
    kind: 'memory',
    label: 'Memory',
    detail: memoryDetail,
    inputText: clipIo([
      'No Memory service — Session log + surface + compaction.',
      `Surface messages before this step: ${surfaceBefore}`,
      compaction === undefined
        ? 'No compaction bracket in scope.'
        : `compactionId=${compaction.id} open=${compaction.open}`,
    ].join('\n')),
    outputText: clipIo(compaction?.summary ?? 'deriveMessages() projects surface nodes into model history'),
    status: memoryActive ? 'active'
      : stepEnded || surfaceBefore > 0 || compaction !== undefined ? 'done'
        : session.running ? 'active' : 'pending',
    turn,
    ...(stepOpt === undefined ? {} : { step: stepOpt }),
  })

  const injections = stepEvents.filter(isContextInjectionMessage)
  const header = stepEvents.find(e => e.type === 'request/header')
  const headerSummary = header?.type === 'request/header'
    ? [
        `reason=${header.data.reason}`,
        `provider=${header.data.header.config.provider}`,
        `model=${header.data.header.config.model}`,
        `tools=${(header.data.header.tools ?? []).length}`,
        `systemChars=${header.data.header.system?.length ?? 0}`,
      ].join('\n')
    : '(no request/header in this step yet)'
  const injectionLines = injections.map(event => {
    if (event.type !== 'user/message') return ''
    const source = event.data.source
    if (source.kind === 'plugin') {
      const form = 'form' in source && typeof source.form === 'string' ? ` form=${source.form}` : ''
      return `${source.plugin}${form}: ${previewContent(event.data.content)}`
    }
    return `${source.kind}: ${previewContent(event.data.content)}`
  }).filter(Boolean)
  const contextReady = header !== undefined || injections.length > 0 || stepEnded
  add({
    id: contextId,
    kind: 'context',
    label: 'Context',
    detail: header !== undefined
      ? `header + ${injections.length} inject`
      : injections.length > 0
        ? `${injections.length} inject`
        : 'assembling…',
    inputText: clipIo([
      'LLM request context = request/header (system+tools) + deriveMessages() + injections.',
      headerSummary,
      injectionLines.length > 0 ? `injections:\n${injectionLines.join('\n')}` : 'injections: (none)',
    ].join('\n\n')),
    outputText: clipIo(header?.type === 'request/header' && header.data.header.system
      ? header.data.header.system
      : injections.length > 0
        ? injections.map(e => e.type === 'user/message' ? fullContent(e.data.content) : '').join('\n---\n')
        : '(awaiting assemble)'),
    status: contextReady ? 'done' : session.running ? 'active' : 'pending',
    turn,
    ...(stepOpt === undefined ? {} : { step: stepOpt }),
  })
  // Control: admit / prior join → Context. Data: Memory + Envelope feed Context.
  link(previousAnchor, contextId, 'flow')
  link(memoryId, contextId, 'data')
  link(envelopeId, contextId, 'data')

  add({
    id: stepId,
    kind: 'step',
    label: pendingStep ? 'Step …' : `Step ${step}`,
    detail: pendingStep ? 'Waiting for step' : 'Host step',
    inputText: clipIo(pendingStep
      ? '(awaiting step/start)'
      : `Turn ${turn} · step ${step} begin`),
    outputText: clipIo(pendingStep
      ? 'No step started yet'
      : stepEnded ? `step/end · turn ${turn} step ${step}` : 'Step in progress'),
    status: pendingStep
      ? (session.running ? 'active' : 'pending')
      : stepEnded ? 'done' : session.running ? 'active' : 'done',
    turn,
    ...(stepOpt === undefined ? {} : { step: stepOpt }),
  })
  link(contextId, stepId, 'flow')

  return { previousAnchor: stepId, stepId, contextId }
}

function deriveEngagingFlow(session: SessionSnapshot): AgentFlowSnapshot {
  if (session.pendingSubmissions.length === 0 && !session.running && !session.promptAttempted) {
    return { ...EMPTY, running: session.running, updatedAt: new Date().toISOString() }
  }
  const pending = session.pendingSubmissions[session.pendingSubmissions.length - 1]
  const inputId = pending ? `input:pending:${pending.requestId}` : 'input:engaging'
  const text = pending?.text ?? 'Prompt attempted'
  const profileId = `profile:${session.sessionId}`
  const sessionNodeId = `session:${session.sessionId}`
  const envelopeId = 'envelope:engaging'
  const nodes: AgentFlowNode[] = [{
    id: profileId,
    kind: 'profile',
    label: 'Profile',
    detail: 'boot composition',
    inputText: clipIo('dsh --profile bundles + patches'),
    outputText: clipIo('Host registries mounted'),
    status: 'done',
    turn: 0,
  }, {
    id: sessionNodeId,
    kind: 'session',
    label: 'Session',
    detail: truncate(String(session.sessionId), 36),
    inputText: clipIo(`sessionId=${session.sessionId}`),
    outputText: clipIo('Awaiting first turn'),
    status: 'active',
    turn: 0,
  }, {
    id: envelopeId,
    kind: 'envelope',
    label: 'Envelope',
    detail: 'awaiting first step',
    inputText: clipIo('request/header (system + tools + config) logs at first step assembly'),
    outputText: clipIo('(not yet logged)'),
    status: 'pending',
    turn: 0,
  }, {
    id: inputId,
    kind: 'client-input',
    label: 'Client input',
    detail: truncate(text, 48),
    inputText: clipIo(text),
    outputText: clipIo('Waiting for Host'),
    status: 'active',
    turn: 0,
  }, {
    id: 'admit:pending',
    kind: 'host-admit',
    label: 'Host',
    detail: 'Awaiting admit',
    inputText: clipIo(text),
    outputText: clipIo('Awaiting turn/start'),
    status: session.running ? 'active' : 'pending',
    turn: 0,
  }]
  return {
    turn: 0,
    nodes,
    edges: [
      { from: profileId, to: sessionNodeId, kind: 'flow' },
      { from: sessionNodeId, to: envelopeId, kind: 'flow' },
      { from: sessionNodeId, to: inputId, kind: 'flow' },
      { from: inputId, to: 'admit:pending', kind: 'flow' },
    ],
    running: session.running,
    updatedAt: new Date().toISOString(),
  }
}

function findLatestTurn(events: readonly SessionEvent[]): number | null {
  let latest: number | null = null
  for (const event of events) {
    if (event.type !== 'turn/start' && event.type !== 'turn/end') continue
    const turn = eventTurn(event)
    if (turn !== undefined) latest = latest === null ? turn : Math.max(latest, turn)
  }
  return latest
}

/**
 * Events belonging to one turn: from that turn's `turn/start` through its
 * `turn/end` (or the log tail when the turn is still open). Needed because
 * surface messages omit a `turn` field.
 */
function eventsInTurn(events: readonly SessionEvent[], turn: number): SessionEvent[] {
  const start = events.find(e => e.type === 'turn/start' && e.data.turn === turn)
  if (start === undefined) {
    return events.filter(e => eventTurn(e) === turn)
  }
  const end = events.find(e => e.type === 'turn/end' && e.data.turn === turn)
  const endSeq = end?.seq
  return events.filter(event => {
    if (event.seq < start.seq) return false
    if (endSeq !== undefined && event.seq > endSeq) return false
    return true
  })
}

/**
 * Events belonging to one step within an already turn-scoped list: from
 * `step/start` through `step/end` (or the next `step/start` / list tail).
 */
function eventsInStep(inTurn: readonly SessionEvent[], step: number): SessionEvent[] {
  const start = inTurn.find(e => e.type === 'step/start' && e.data.step === step)
  if (start === undefined) {
    return inTurn.filter(e => eventStep(e) === step)
  }
  const end = inTurn.find(e => e.type === 'step/end' && e.data.step === step)
  const nextStart = inTurn.find(e => e.type === 'step/start' && e.data.step > step)
  return inTurn.filter(event => {
    if (event.seq < start.seq) return false
    if (end !== undefined && event.seq > end.seq) return false
    if (end === undefined && nextStart !== undefined && event.seq >= nextStart.seq) return false
    return true
  })
}

function eventTurn(event: SessionEvent): number | undefined {
  const data = event.data as { turn?: unknown }
  return typeof data?.turn === 'number' ? data.turn : undefined
}

function eventStep(event: SessionEvent): number | undefined {
  const data = event.data as { step?: unknown }
  return typeof data?.step === 'number' ? data.step : undefined
}

function eventTypeName(event: SessionEvent): string {
  return (event as { type: string }).type
}

function isUserPromptMessage(event: SessionEvent): boolean {
  if (event.type !== 'user/message') return false
  return event.data.source.kind === 'user'
}

function isContextInjectionMessage(event: SessionEvent): boolean {
  if (event.type !== 'user/message') return false
  const source = event.data.source
  if (source.kind === 'user') return false
  if (source.kind === 'plugin' && source.plugin === 'compact') return false
  return true
}

function readAgentPreset(events: readonly SessionEvent[]): string | undefined {
  let preset: string | undefined
  for (const event of events) {
    if (eventTypeName(event) !== 'agent-preset/selected') continue
    const agentPreset = (event.data as { agentPreset?: unknown }).agentPreset
    if (typeof agentPreset === 'string') preset = agentPreset
  }
  return preset
}

function latestRequestHeader(events: readonly SessionEvent[]): SessionEvent | undefined {
  let latest: SessionEvent | undefined
  for (const event of events) {
    if (event.type === 'request/header') latest = event
  }
  return latest
}

function countSurfaceMessages(
  events: readonly SessionEvent[],
  turn: number,
  beforeStep: number | undefined,
): number {
  const turnStart = events.find(e => e.type === 'turn/start' && e.data.turn === turn)
  const cutoff = beforeStep === undefined || turnStart === undefined
    ? undefined
    : eventsInTurn(events, turn).find(e => e.type === 'step/start' && e.data.step === beforeStep)?.seq
  let count = 0
  for (const event of events) {
    if (event.type !== 'user/message' && event.type !== 'assistant/message' && event.type !== 'tool/result') {
      continue
    }
    if (cutoff !== undefined && event.seq >= cutoff) continue
    if (turnStart === undefined) {
      const eventTurnNum = eventTurn(event)
      if (eventTurnNum !== undefined && eventTurnNum > turn) continue
    }
    count += 1
  }
  return count
}

function findCompaction(
  events: readonly SessionEvent[],
  turn: number,
  step: number | undefined,
): { id: string; open: boolean; summary?: string } | undefined {
  let openId: string | undefined
  let lastId: string | undefined
  let summary: string | undefined
  for (const event of events) {
    const type = eventTypeName(event)
    const eventTurnNum = eventTurn(event)
    if (type === 'compaction/start') {
      if (eventTurnNum !== undefined && eventTurnNum !== turn && eventTurnNum !== null) continue
      const id = String((event.data as { compactionId?: unknown }).compactionId ?? event.seq)
      openId = id
      lastId = id
    } else if (type === 'compaction/end') {
      const id = String((event.data as { compactionId?: unknown }).compactionId ?? '')
      if (openId !== undefined && (id === '' || id === openId)) openId = undefined
    } else if (event.type === 'user/message'
      && event.data.source.kind === 'plugin'
      && event.data.source.plugin === 'compact') {
      const eventStepNum = eventStep(event)
      if (step !== undefined && eventStepNum !== undefined && eventStepNum > step) continue
      summary = fullContent(event.data.content)
      lastId = lastId ?? `compact:${event.seq}`
    }
  }
  if (lastId === undefined && summary === undefined) return undefined
  return {
    id: lastId ?? 'compact',
    open: openId !== undefined,
    ...(summary === undefined ? {} : { summary }),
  }
}

function contentToolCalls(content: readonly ContentBlock[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const block of content) {
    if (block.type === 'tool-call') out.push({ id: block.id, name: block.name })
  }
  return out
}

function fullContent(content: readonly ContentBlock[]): string {
  const parts: string[] = []
  for (const block of content) {
    switch (block.type) {
      case 'text':
        if (block.text.trim()) parts.push(block.text)
        break
      case 'reasoning':
        if (block.text.trim()) parts.push(`[reasoning]\n${block.text}`)
        break
      case 'tool-call':
        parts.push(`[tool-call ${block.name}]\n${block.arguments}`)
        break
      case 'tool-result':
        parts.push(`[tool-result ${block.toolCallId}${block.isError ? ' ERROR' : ''}]\n${fullContent(block.content)}`)
        break
      case 'image':
        parts.push('[image]')
        break
      case 'file':
        parts.push('[file]')
        break
      default:
        parts.push(`[${(block as { type: string }).type}]`)
    }
  }
  return parts.join('\n\n') || '(empty)'
}

function previewContent(content: readonly ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text' && block.text.trim()) return truncate(block.text, 48)
  }
  return content.length > 0 ? `(${content.length} blocks)` : '(empty)'
}

function previewAssistant(event: SessionEvent): string {
  if (event.type !== 'assistant/message') return 'Assistant'
  const text = previewContent(event.data.message.content)
  const tools = contentToolCalls(event.data.message.content)
  if (tools.length > 0) return `${tools.length} tool call(s)`
  return text
}

function truncate(text: string, max: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`
}

function clipIo(text: string): string {
  return text.length <= IO_MAX ? text : `${text.slice(0, IO_MAX - 1)}…`
}
