/**
 * Agent process flow graph derived from a Client Session event window.
 *
 * Bands: Client · Web/CLI (Input + session.prompt + session.follow + Render)
 * → Host · Frame → Host · Step N. Wire nodes name Typert Remote methods.
 */

import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Lifecycle of one flow node on the Agent process canvas. */
export type FlowNodeStatus = 'pending' | 'active' | 'done' | 'error'

/**
 * Kind of pipeline stage.
 *
 * Client: `client-input`, `remote-prompt`, `remote-follow`, `client-render`.
 * Host frame: `profile`, `session`, `envelope`, `host-admit`.
 * Per-step: `memory`, `context`, `model`, `tool`, `join`.
 */
export type FlowNodeKind =
  | 'profile'
  | 'session'
  | 'envelope'
  | 'memory'
  | 'context'
  | 'client-input'
  | 'remote-prompt'
  | 'remote-follow'
  | 'host-admit'
  | 'model'
  | 'tool'
  | 'join'
  | 'client-render'

/** One node in the Client ↔ Host process pipeline. */
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
  /** Owning Host step; absent for Client / Host-frame nodes. */
  readonly step?: number
  readonly callId?: string
}

/** Directed edge between flow nodes. */
export interface AgentFlowEdge {
  readonly from: string
  readonly to: string
  /** `flow` = control / handoff; `data` = durable or wire payload. */
  readonly kind: 'flow' | 'data'
  /** Optional mid-edge caption (Client↔Host wire names). */
  readonly label?: string
}

/** Flow snapshot for one Agent Session (focus Turn or latest). */
export interface AgentFlowSnapshot {
  readonly turn: number | null
  /** Session max Turn (for Jump to latest); independent of the focused fold. */
  readonly latestTurn: number | null
  /** Latest `agent-preset/selected` id when known (Host · Frame band label). */
  readonly agentPreset?: string
  /**
   * Client surface for this turn's user prompt.
   * Heuristic: `user` source with `clientTimeZone` → web; otherwise cli/remote.
   */
  readonly clientSurface?: 'web' | 'cli'
  readonly nodes: readonly AgentFlowNode[]
  readonly edges: readonly AgentFlowEdge[]
  readonly running: boolean
  readonly updatedAt: string
}

const EMPTY: AgentFlowSnapshot = {
  turn: null,
  latestTurn: null,
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
 * Fold the event window into a process topology for the focus Turn or latest.
 * @param window - Session event window from the Client binding.
 * @param session - Session lifecycle snapshot (running / pending).
 * @param focusTurn - Pinned Turn number, or `null`/omitted for the Session latest.
 * @returns flow graph with active highlights.
 */
export function deriveAgentFlow(
  window: SessionEventWindow,
  session: SessionSnapshot,
  focusTurn: number | null = null,
): AgentFlowSnapshot {
  const durable: SessionEvent[] = []
  for (const entry of window.entries) {
    if (entry.type === 'event') durable.push(entry.event)
  }

  const latestTurn = findLatestTurn(durable)
  if (latestTurn === null && focusTurn === null) {
    return deriveEngagingFlow(session)
  }
  const targetTurn = focusTurn ?? latestTurn
  if (targetTurn === null) {
    return { ...EMPTY, latestTurn, running: session.running, updatedAt: new Date().toISOString() }
  }
  if (focusTurn !== null && !durable.some(e =>
    (e.type === 'turn/start' || e.type === 'turn/end') && e.data.turn === focusTurn
  )) {
    return {
      turn: focusTurn,
      latestTurn,
      nodes: [],
      edges: [],
      running: session.running,
      updatedAt: new Date().toISOString(),
    }
  }

  // user/message and some injections carry no turn field — scope by turn/start…turn/end seq range.
  const inTurn = eventsInTurn(durable, targetTurn)
  const nodes: AgentFlowNode[] = []
  const edges: AgentFlowEdge[] = []
  const add = (node: AgentFlowNode): void => { nodes.push(node) }
  const link = (
    from: string,
    to: string,
    kind: AgentFlowEdge['kind'] = 'flow',
    label?: string,
  ): void => {
    edges.push(label === undefined ? { from, to, kind } : { from, to, kind, label })
  }

  const turnEnded = inTurn.some(e => e.type === 'turn/end')
  const turnError = inTurn.find(e => e.type === 'turn/end'
    && (e.data.reason.kind === 'error' || e.data.reason.kind === 'aborted'))
  // Pinned historical turns settle from their own turn/end even while Session runs a newer turn.
  const live = session.running && !turnEnded
  const frameStatus: FlowNodeStatus = turnEnded
    ? (turnError ? 'error' : 'done')
    : live ? 'active' : 'done'

  const { sessionId, envelopeId, agentPreset } = addHarnessFrame({
    add,
    link,
    session,
    durable,
    inTurn,
    turn: targetTurn,
    status: frameStatus,
    live,
  })

  const inputs = inTurn.filter(isUserPromptMessage)
  const inputIds: string[] = []
  let aggregatedInput = ''
  let clientSurface: 'web' | 'cli' = 'web'
  if (inputs.length === 0 && session.pendingSubmissions.length > 0 && live) {
    // Pending echo from this Observe tab (Web Client plugin).
    const pending = session.pendingSubmissions[session.pendingSubmissions.length - 1]!
    const id = `input:pending:${pending.requestId}`
    inputIds.push(id)
    aggregatedInput = pending.text
    clientSurface = 'web'
    add({
      id,
      kind: 'client-input',
      label: 'Web input',
      detail: truncate(pending.text, 48) || '(attachment)',
      inputText: clipIo([
        'Client surface: web (pending submission from Web Client).',
        pending.text || '(attachment)',
      ].join('\n')),
      outputText: clipIo('Queued for Host admit'),
      status: 'active',
      turn: targetTurn,
    })
  } else {
    inputs.forEach((event, index) => {
      if (event.type !== 'user/message') return
      const id = `input:${event.seq}`
      inputIds.push(id)
      const full = fullContent(event.data.content)
      aggregatedInput = aggregatedInput ? `${aggregatedInput}\n---\n${full}` : full
      const surface = detectClientSurface(event.data.source)
      if (index === 0) clientSurface = surface
      const surfaceLabel = surface === 'web' ? 'Web input' : 'CLI input'
      add({
        id,
        kind: 'client-input',
        label: index === 0 ? surfaceLabel : `${surfaceLabel} ${index + 1}`,
        detail: previewContent(event.data.content),
        inputText: clipIo([
          `Client surface: ${surface}${surfaceEvidence(event.data.source)}`,
          full,
        ].join('\n')),
        outputText: clipIo(`Remote prompt accepted → Host inbox (seq ${event.seq})`),
        status: 'done',
        turn: targetTurn,
      })
    })
  }

  const admitId = `admit:${targetTurn}`
  const promptId = `remote-prompt:${targetTurn}`
  const followId = `remote-follow:${targetTurn}`

  if (inputIds.length > 0) {
    add({
      id: promptId,
      kind: 'remote-prompt',
      label: 'session.prompt',
      detail: 'Typert Remote',
      inputText: clipIo([
        'Client → Host unary Remote: ctx.remote.session.prompt(SessionPromptRequest).',
        'Carrier: Connection HTTP /api (Typert Gateway).',
        'Fields: requestId, sessionId, mode, content, optional clientTimeZone.',
        aggregatedInput || '(no user message yet)',
      ].join('\n')),
      outputText: clipIo('SessionPromptValue { accepted: true } → Host SessionController.prompt'),
      status: 'done',
      turn: targetTurn,
    })
  }

  add({
    id: admitId,
    kind: 'host-admit',
    label: 'Host admit',
    detail: 'SessionController',
    inputText: clipIo([
      'Host-local after the wire: SessionController.prompt → agent.followup/steer → inbox.',
      'followup/steer never cross the process boundary.',
      aggregatedInput || '(no user message yet)',
    ].join('\n')),
    outputText: clipIo(turnEnded
      ? `turn/end · Turn ${targetTurn} closed`
      : `turn/start open · running=${session.running}`),
    status: frameStatus,
    turn: targetTurn,
  })
  // Client packs prompt → Remote session.prompt → Host admit (Host-local inbox).
  for (const inputId of inputIds) {
    link(inputId, promptId, 'data')
    link(promptId, admitId, 'data', 'session.prompt')
  }
  if (inputIds.length === 0) link(sessionId, admitId, 'flow')

  let previousAnchor = admitId
  const modelIds: string[] = []
  const stepStarts = inTurn.filter(e => e.type === 'step/start')
  const stepNumbers = [...new Set(stepStarts.map(e => e.type === 'step/start' ? e.data.step : 0))]
    .sort((a, b) => a - b)

  if (stepNumbers.length === 0 && !turnEnded) {
    const pending = addStepAssembly({
      add,
      link,
      turn: targetTurn,
      step: 0,
      stepKey: 'pending',
      envelopeId,
      previousAnchor,
      session,
      durable,
      stepEvents: inTurn,
      stepEnded: false,
      pendingStep: true,
      live,
    })
    previousAnchor = pending.previousAnchor
  }

  for (const step of stepNumbers) {
    const stepEvents = eventsInStep(inTurn, step)
    const stepEnded = stepEvents.some(e => e.type === 'step/end')
    const assembled = addStepAssembly({
      add,
      link,
      turn: targetTurn,
      step,
      stepKey: String(step),
      envelopeId,
      previousAnchor,
      session,
      durable,
      stepEvents,
      stepEnded,
      pendingStep: false,
      live,
    })
    previousAnchor = assembled.previousAnchor

    const assistants = stepEvents.filter(e => e.type === 'assistant/message')
    const modelId = `model:${targetTurn}:${step}`
    modelIds.push(modelId)
    const hasAssistant = assistants.length > 0
    const streaming = live && !stepEnded && !hasAssistant
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
      : 'GenerateOptions (awaiting request/header)'

    add({
      id: modelId,
      kind: 'model',
      label: 'Model',
      detail: streaming ? 'Streaming…'
        : hasAssistant ? previewAssistant(lastAssistant!) : 'Request',
      inputText: clipIo([
        'llm.stream(GenerateOptions) = EpochHeader fields + deriveMessages().',
        'Canvas "Context" = that assembled request (not Cordis Context / request/context).',
        requestSummary,
      ].join('\n')),
      outputText: clipIo(streaming
        ? '(streaming… Host-local agent/assistant-stream; settles as assistant/message)'
        : assistantFull || '(no assistant/message yet)'),
      status: streaming ? 'active' : hasAssistant || stepEnded ? 'done' : live ? 'active' : 'pending',
      turn: targetTurn,
      step,
    })
    // Context → Model: assembled request payload. Model → Session: assistant/message surface.
    link(assembled.contextId, modelId, 'data')
    link(modelId, sessionId, 'data')

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
        status: done ? (info.error ? 'error' : 'done') : live ? 'active' : 'pending',
        turn: targetTurn,
        step,
        callId,
      })
      // Args from Model; tool/result appends to Session surface (next Memory / Client follow).
      link(modelId, id, 'data')
      link(id, sessionId, 'data')
    }

    previousAnchor = toolIds.length > 0 ? toolIds[toolIds.length - 1]! : modelId
    if (toolIds.length > 1) {
      const joinId = `join:${targetTurn}:${step}`
      add({
        id: joinId,
        kind: 'join',
        label: 'Join',
        detail: `${toolIds.length} parallel tools`,
        inputText: clipIo(`${toolIds.length} parallel tool branches (Host tool pool)`),
        outputText: clipIo('Continue to next step claim / turn-stopping'),
        status: toolIds.every(id => nodes.find(n => n.id === id)?.status === 'done'
          || nodes.find(n => n.id === id)?.status === 'error')
          ? 'done'
          : live ? 'active' : 'pending',
        turn: targetTurn,
        step,
      })
      for (const toolId of toolIds) link(toolId, joinId, 'flow')
      previousAnchor = joinId
    }
  }

  const endReason = turnError?.type === 'turn/end' ? turnError.data.reason.kind
    : turnEnded ? 'completed' : live ? 'in-progress' : 'open'
  const renderId = `client-render:${targetTurn}`

  add({
    id: followId,
    kind: 'remote-follow',
    label: 'session.follow',
    detail: 'Typert Remote stream',
    inputText: clipIo([
      'Host → Client stream: ctx.remote.session.follow → SessionFollowFrame[].',
      'Carrier: Connection WebSocket /api/remote.mux (or in-process open).',
      'Frames: snapshot | event (SessionWireEvent) | assistant-stream (opt-in).',
      'Host Cordis session/event and agent/assistant-stream stay process-local;',
      'history.follow repackages them onto this Remote stream.',
    ].join('\n')),
    outputText: clipIo('Client SessionEventStream applies journal → Conversation / Canvas UI'),
    status: turnEnded ? 'done' : live ? 'active' : 'done',
    turn: targetTurn,
  })

  add({
    id: renderId,
    kind: 'client-render',
    label: 'Client render',
    detail: turnEnded ? 'Settled' : 'Live UI',
    inputText: clipIo([
      'UI binds SessionBinding.eventSource (follow frames), not llm.stream.',
      `turn=${targetTurn} reason=${endReason}`,
    ].join('\n')),
    outputText: clipIo(turnEnded ? 'Chat / Trajectory settled' : 'Live stream / cards'),
    status: turnError ? 'error' : turnEnded ? 'done' : live ? 'active' : 'done',
    turn: targetTurn,
  })
  // Durable log + Model transcript feed follow; follow feeds Client render.
  link(sessionId, followId, 'data')
  for (const modelId of modelIds) {
    link(modelId, followId, 'data', 'assistant')
  }
  link(followId, renderId, 'data', 'session.follow')
  // Host tool/join settle does not invent a Client wire — turn progress still exits via follow.
  if (!modelIds.includes(previousAnchor)) {
    link(previousAnchor, followId, 'flow')
  }

  return {
    turn: targetTurn,
    latestTurn,
    ...(agentPreset === undefined ? {} : { agentPreset }),
    clientSurface,
    nodes,
    edges,
    running: session.running,
    updatedAt: new Date().toISOString(),
  }
}

function addHarnessFrame(args: {
  add: (node: AgentFlowNode) => void
  link: (from: string, to: string, kind?: AgentFlowEdge['kind'], label?: string) => void
  session: SessionSnapshot
  durable: readonly SessionEvent[]
  inTurn: readonly SessionEvent[]
  turn: number
  status: FlowNodeStatus
  live: boolean
}): { profileId: string; sessionId: string; envelopeId: string; agentPreset?: string } {
  const { add, link, session, durable, inTurn, turn, status, live } = args
  const profileId = `profile:${session.sessionId}`
  const sessionNodeId = `session:${session.sessionId}`
  const envelopeId = `envelope:${turn}`
  const agentPreset = readAgentPreset(durable)

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
    inputText: clipIo([
      `sessionId=${session.sessionId}`,
      'Append-only event log (single source of truth for model-visible history).',
    ].join('\n')),
    outputText: clipIo([
      `blank=${session.blank}`,
      `running=${session.running}`,
      `awaitingFirstTurn=${session.awaitingFirstTurn}`,
      'Clients follow session/event + assistant-stream; deriveMessages() reads surface.',
    ].join('\n')),
    status,
    turn,
  })
  link(profileId, sessionNodeId, 'flow')

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
    agentPreset === undefined ? undefined : `preset=${agentPreset}`,
    toolNames.length > 0 ? `tools=${toolNames.length}` : undefined,
    model === undefined ? undefined : `model=${model}`,
  ].filter((part): part is string => part !== undefined)
  const hasEnvelopeEvidence = header !== undefined || agentPreset !== undefined
  add({
    id: envelopeId,
    kind: 'envelope',
    label: 'Envelope',
    detail: envelopeParts.length > 0 ? envelopeParts.join(' · ') : 'awaiting request/header',
    inputText: clipIo([
      'Logged EpochHeader via request/header (system + tools + call config) + agentPreset.',
      agentPreset === undefined ? 'agentPreset=(unknown)' : `agentPreset=${agentPreset}`,
      toolNames.length > 0 ? `tools: ${toolNames.join(', ')}` : 'tools: (none logged yet)',
      model === undefined ? 'model: (none logged yet)' : `model: ${model}`,
    ].join('\n')),
    outputText: clipIo(systemPreview
      ? `system prompt (${systemPreview.length} chars)\n${systemPreview}`
      : '(no request/header system yet — logged at first step assembly)'),
    status: hasEnvelopeEvidence ? 'done' : live ? 'active' : 'pending',
    turn,
  })
  // Header is Session-logged state (foldRequestHeader), not a separate Resource service.
  link(sessionNodeId, envelopeId, 'data')

  return {
    profileId,
    sessionId: sessionNodeId,
    envelopeId,
    ...(agentPreset === undefined ? {} : { agentPreset }),
  }
}

function addStepAssembly(args: {
  add: (node: AgentFlowNode) => void
  link: (from: string, to: string, kind?: AgentFlowEdge['kind'], label?: string) => void
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
  live: boolean
}): { previousAnchor: string; contextId: string } {
  const {
    add, link, turn, step, stepKey, envelopeId, previousAnchor, session,
    durable, stepEvents, stepEnded, pendingStep, live,
  } = args
  // Pending (no step/start yet) still paints in the Host · Step band via step: 0.
  const stepOpt = pendingStep ? 0 : step
  const memoryId = `memory:${turn}:${stepKey}`
  const contextId = `context:${turn}:${stepKey}`

  const surfaceBefore = countSurfaceMessages(durable, turn, pendingStep ? undefined : step)
  const compaction = findCompaction(durable, turn, pendingStep ? undefined : step)
  const memoryDetail = compaction === undefined
    ? `Session surface · ${surfaceBefore} msg`
    : `compaction · Session surface · ${surfaceBefore} msg`
  const memoryActive = live && !stepEnded && compaction !== undefined && compaction.open
  add({
    id: memoryId,
    kind: 'memory',
    label: 'Memory',
    detail: memoryDetail,
    inputText: clipIo([
      'No Memory service — Session surface (user/message | assistant/message | tool/result) + compaction.',
      `Surface nodes before this step: ${surfaceBefore}`,
      compaction === undefined
        ? 'No compaction bracket in scope.'
        : `compactionId=${compaction.id} open=${compaction.open}`,
    ].join('\n')),
    outputText: clipIo(compaction?.summary
      ?? 'session.deriveMessages() → Message[] history for GenerateOptions'),
    status: memoryActive ? 'active'
      : stepEnded || surfaceBefore > 0 || compaction !== undefined ? 'done'
        : live ? 'active' : 'pending',
    turn,
    step: stepOpt,
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
      ? `header + surface${injections.length > 0 ? ` · ${injections.length} inject` : ''}`
      : injections.length > 0
        ? `${injections.length} inject`
        : 'assembling…',
    inputText: clipIo([
      'Assembled LLM request = EpochHeader (system+tools+config) + deriveMessages().',
      'Plugin injections are already on Session surface before deriveMessages — not a third feed.',
      headerSummary,
      injectionLines.length > 0
        ? `surface injections this step:\n${injectionLines.join('\n')}`
        : 'surface injections this step: (none)',
    ].join('\n\n')),
    outputText: clipIo(header?.type === 'request/header'
      ? [
          'GenerateOptions ready for llm.stream:',
          `systemChars=${header.data.header.system?.length ?? 0}`,
          `tools=${(header.data.header.tools ?? []).length}`,
          `provider/model=${header.data.header.config.provider}/${header.data.header.config.model}`,
        ].join('\n')
      : '(awaiting assemble / request/header)'),
    status: contextReady ? 'done' : live ? 'active' : 'pending',
    turn,
    step: stepOpt,
  })
  // Control: admit / prior join → Context. Data: Memory + Envelope feed Context.
  link(previousAnchor, contextId, 'flow')
  link(memoryId, contextId, 'data')
  link(envelopeId, contextId, 'data')

  return { previousAnchor: contextId, contextId }
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
    label: 'Web input',
    detail: truncate(text, 48),
    inputText: clipIo([
      'Client surface: web (Canvas is a Web Client plugin).',
      text,
    ].join('\n')),
    outputText: clipIo('Waiting for Host'),
    status: 'active',
    turn: 0,
  }, {
    id: 'remote-prompt:pending',
    kind: 'remote-prompt',
    label: 'session.prompt',
    detail: 'Typert Remote',
    inputText: clipIo('SessionPromptRequest pending'),
    outputText: clipIo('Awaiting Host SessionController.prompt'),
    status: 'active',
    turn: 0,
  }, {
    id: 'remote-follow:pending',
    kind: 'remote-follow',
    label: 'session.follow',
    detail: 'Typert Remote stream',
    inputText: clipIo('Awaiting Host journal frames'),
    outputText: clipIo('Client SessionEventStream idle'),
    status: 'pending',
    turn: 0,
  }, {
    id: 'admit:pending',
    kind: 'host-admit',
    label: 'Host admit',
    detail: 'SessionController',
    inputText: clipIo(text),
    outputText: clipIo('Awaiting turn/start'),
    status: session.running ? 'active' : 'pending',
    turn: 0,
  }]
  return {
    turn: 0,
    latestTurn: null,
    clientSurface: 'web',
    nodes,
    edges: [
      { from: profileId, to: sessionNodeId, kind: 'flow' },
      { from: sessionNodeId, to: envelopeId, kind: 'data' },
      { from: inputId, to: 'remote-prompt:pending', kind: 'data' },
      { from: 'remote-prompt:pending', to: 'admit:pending', kind: 'data', label: 'session.prompt' },
      { from: sessionNodeId, to: 'remote-follow:pending', kind: 'data' },
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

/**
 * Infer Web vs CLI/remote from durable user source fields.
 * Web Client prompts carry `clientTimeZone`; CLI/SDK/ACP usually omit it.
 */
function detectClientSurface(source: { readonly kind: string }): 'web' | 'cli' {
  if (source.kind !== 'user') return 'cli'
  const zone = (source as { clientTimeZone?: unknown }).clientTimeZone
  return typeof zone === 'string' && zone.length > 0 ? 'web' : 'cli'
}

function surfaceEvidence(source: { readonly kind: string }): string {
  if (source.kind !== 'user') return ''
  const zone = (source as { clientTimeZone?: unknown }).clientTimeZone
  const rpcId = (source as { rpcId?: unknown }).rpcId
  const parts: string[] = []
  if (typeof zone === 'string' && zone.length > 0) parts.push(`clientTimeZone=${zone}`)
  if (typeof rpcId === 'string') parts.push(`rpcId=${rpcId}`)
  return parts.length > 0 ? ` (${parts.join(', ')})` : ' (no clientTimeZone on source)'
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
