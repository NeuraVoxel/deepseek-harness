/**
 * Agent turn/step/tool flow graph derived from a Client Session event window.
 */

import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Lifecycle of one flow node on the Agent process canvas. */
export type FlowNodeStatus = 'pending' | 'active' | 'done' | 'error'

/** Kind of pipeline stage. */
export type FlowNodeKind =
  | 'client-input'
  | 'host-admit'
  | 'step'
  | 'model'
  | 'tool'
  | 'turn-end'
  | 'client-render'

/** One node in the Client→Host→Model→Tools→Client pipeline. */
export interface AgentFlowNode {
  readonly id: string
  readonly kind: FlowNodeKind
  readonly label: string
  readonly detail?: string
  /** Full input payload for hover inspection. */
  readonly inputText: string
  /** Full output payload for hover inspection. */
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

  const inTurn = durable.filter(event => eventTurn(event) === latestTurn)
  const nodes: AgentFlowNode[] = []
  const edges: AgentFlowEdge[] = []
  const add = (node: AgentFlowNode): void => { nodes.push(node) }
  const link = (from: string, to: string): void => { edges.push({ from, to }) }

  const turnEnded = inTurn.some(e => e.type === 'turn/end')
  const turnError = inTurn.find(e => e.type === 'turn/end'
    && (e.data.reason.kind === 'error' || e.data.reason.kind === 'aborted'))

  const inputs = inTurn.filter(e => e.type === 'user/message')
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
    status: turnEnded ? (turnError ? 'error' : 'done') : session.running ? 'active' : 'done',
    turn: latestTurn,
  })
  for (const inputId of inputIds) link(inputId, admitId)

  let previousAnchor = admitId
  const stepStarts = inTurn.filter(e => e.type === 'step/start')
  const stepNumbers = [...new Set(stepStarts.map(e => e.type === 'step/start' ? e.data.step : 0))]
    .sort((a, b) => a - b)

  if (stepNumbers.length === 0 && !turnEnded) {
    const stepId = `step:${latestTurn}:pending`
    add({
      id: stepId,
      kind: 'step',
      label: 'Step …',
      detail: 'Waiting for step',
      inputText: clipIo(aggregatedInput || '(awaiting step/start)'),
      outputText: clipIo('No step started yet'),
      status: session.running ? 'active' : 'pending',
      turn: latestTurn,
    })
    link(previousAnchor, stepId)
    previousAnchor = stepId
  }

  for (const step of stepNumbers) {
    const stepEvents = inTurn.filter(e => eventStep(e) === step || (e.type === 'step/start' && e.data.step === step)
      || (e.type === 'step/end' && e.data.step === step))
    const stepEnded = stepEvents.some(e => e.type === 'step/end')
    const stepId = `step:${latestTurn}:${step}`
    add({
      id: stepId,
      kind: 'step',
      label: `Step ${step}`,
      detail: 'Host step',
      inputText: clipIo(`Turn ${latestTurn} · step ${step} begin`),
      outputText: clipIo(stepEnded ? `step/end · turn ${latestTurn} step ${step}` : 'Step in progress'),
      status: stepEnded ? 'done' : session.running ? 'active' : 'done',
      turn: latestTurn,
      step,
    })
    link(previousAnchor, stepId)

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
    link(stepId, modelId)

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
        kind: 'step',
        label: 'Join',
        detail: 'Tools settled',
        inputText: clipIo(`${toolIds.length} tool branches`),
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

function deriveEngagingFlow(session: SessionSnapshot): AgentFlowSnapshot {
  if (session.pendingSubmissions.length === 0 && !session.running && !session.promptAttempted) {
    return { ...EMPTY, running: session.running, updatedAt: new Date().toISOString() }
  }
  const pending = session.pendingSubmissions[session.pendingSubmissions.length - 1]
  const inputId = pending ? `input:pending:${pending.requestId}` : 'input:engaging'
  const text = pending?.text ?? 'Prompt attempted'
  const nodes: AgentFlowNode[] = [{
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
    edges: [{ from: inputId, to: 'admit:pending' }],
    running: session.running,
    updatedAt: new Date().toISOString(),
  }
}

function findLatestTurn(events: readonly SessionEvent[]): number | null {
  let latest: number | null = null
  for (const event of events) {
    const turn = eventTurn(event)
    if (turn !== undefined) latest = latest === null ? turn : Math.max(latest, turn)
  }
  return latest
}

function eventTurn(event: SessionEvent): number | undefined {
  const data = event.data as { turn?: unknown }
  return typeof data?.turn === 'number' ? data.turn : undefined
}

function eventStep(event: SessionEvent): number | undefined {
  const data = event.data as { step?: unknown }
  return typeof data?.step === 'number' ? data.step : undefined
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
