/**
 * DataFlow inspect: Session payloads for E2E + per-Step nodes.
 */

import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { FlowNodeInspect } from '../types.ts'
import type { DataFlowGraphBuild } from './build-graph.ts'
import { toolResultCallId } from './build-graph.ts'

/** Panel clip ceiling (larger than Process teaching IO). */
export const DATAFLOW_IO_MAX = 16_000

/**
 * @param build - graph build handles (events + node ids).
 * @param session - Client Session lifecycle snapshot.
 * @param t - locale lookup.
 * @returns inspect map keyed by DataFlow node id.
 */
export function projectDataFlowInspect(
  build: DataFlowGraphBuild,
  session: SessionSnapshot,
  t: (key: string, params?: Record<string, string>) => string,
): Map<string, FlowNodeInspect> {
  const { events, durable, steps, turn, document } = build
  const map = new Map<string, FlowNodeInspect>()
  const none = t('flow.dataflow.noPayload')

  for (const node of document.nodes) {
    map.set(node.id, inspectNode(node.id, events, durable, steps, turn, session, none, t))
  }
  return map
}

function inspectNode(
  id: string,
  events: readonly SessionEvent[],
  durable: readonly SessionEvent[],
  steps: DataFlowGraphBuild['steps'],
  turn: number | null,
  session: SessionSnapshot,
  none: string,
  t: (key: string, params?: Record<string, string>) => string,
): FlowNodeInspect {
  if (id === 'df:e2e:client') {
    const users = events.filter(e => e.type === 'user/message' && isUserSource(e))
    if (users.length === 0) {
      return { detail: t('flow.dataflow.role.clientInput'), inputText: none, outputText: none }
    }
    const bodies = users.map(e => e.type === 'user/message' ? contentText(e.data.content) : '')
    return {
      detail: t('flow.dataflow.role.clientInput'),
      inputText: clip(bodies.join('\n---\n')),
      outputText: clip(pretty({ wire: 'session.prompt', messages: users.length })),
      organizedText: clip(pretty(users.map(e => e.type === 'user/message' ? {
        seq: e.seq,
        source: e.data.source,
        content: e.data.content,
      } : e))),
    }
  }

  if (id === 'df:e2e:admit' || id === 'df:turn:start') {
    const turnStart = events.find(e => e.type === 'turn/start')
    const inbox = durable.filter(e => (e as { type: string }).type === 'agent/inbox/spliced')
    return {
      detail: t('flow.dataflow.role.hostAdmit'),
      inputText: turnStart?.type === 'turn/start'
        ? clip(pretty(turnStart.data))
        : none,
      outputText: inbox.length > 0
        ? clip(pretty(inbox.map(e => ({ type: e.type, seq: e.seq }))))
        : clip(pretty({ turn, admitted: turnStart !== undefined })),
      organizedText: clip(pretty({
        turn,
        turnStart: turnStart?.type === 'turn/start' ? turnStart.data : undefined,
        inboxEvents: inbox.length,
      })),
    }
  }

  if (id === 'df:turn:end') {
    const turnEnd = events.find(e => e.type === 'turn/end')
    return {
      detail: t('flow.dataflow.role.turnEnd'),
      inputText: turnEnd?.type === 'turn/end' ? clip(pretty(turnEnd.data)) : none,
      outputText: turnEnd?.type === 'turn/end'
        ? clip(String(turnEnd.data.reason.kind))
        : none,
      ...(turnEnd?.type === 'turn/end'
        ? { organizedText: clip(pretty(turnEnd.data)) }
        : {}),
    }
  }

  if (id === 'df:e2e:session') {
    const surface = events.filter(isSurfaceEvent)
    return {
      detail: t('flow.dataflow.role.session'),
      inputText: clip(String(session.sessionId)),
      outputText: clip(pretty({
        openState: session.openState,
        running: session.running,
        turn,
        surfaceEvents: surface.length,
      })),
      organizedText: clip(pretty(surface.map(e => ({ type: e.type, seq: e.seq })))),
    }
  }

  if (id === 'df:e2e:model') {
    const assistants = events.filter(e => e.type === 'assistant/message')
    const last = assistants[assistants.length - 1]
    return {
      detail: t('flow.dataflow.role.modelOverview'),
      inputText: clip(pretty({
        steps: steps.map(s => s.step),
        headers: events.filter(e => e.type === 'request/header').length,
      })),
      outputText: last?.type === 'assistant/message'
        ? clip(contentText(last.data.message.content))
        : none,
      ...(last?.type === 'assistant/message'
        ? { organizedText: clip(pretty({
          stepCount: steps.length,
          lastAssistant: last.data.message,
        })) }
        : {}),
    }
  }

  if (id === 'df:e2e:tools') {
    const calls = events.filter(e => e.type === 'tool/call')
    if (calls.length === 0) {
      return { detail: t('flow.dataflow.role.toolsOverview'), inputText: none, outputText: none }
    }
    return {
      detail: t('flow.dataflow.role.toolsOverview'),
      inputText: clip(calls.map(e => e.type === 'tool/call'
        ? `${e.data.name}:${e.data.callId}`
        : '').join('\n')),
      outputText: clip(pretty({ count: calls.length })),
      organizedText: clip(pretty(calls.map(e => e.type === 'tool/call' ? e.data : e))),
    }
  }

  if (id === 'df:e2e:write') {
    const written = events.filter(e =>
      e.type === 'assistant/message' || e.type === 'tool/result' || e.type === 'user/message',
    )
    return {
      detail: t('flow.dataflow.role.write'),
      inputText: written.length > 0
        ? clip(written.map(summarizeSurfaceEvent).join('\n---\n'))
        : none,
      outputText: clip(pretty({ appended: written.length })),
      organizedText: clip(pretty(written.map(e => ({
        type: e.type,
        seq: e.seq,
        surfaceOp: e.surfaceOp,
      })))),
    }
  }

  if (id === 'df:e2e:render') {
    const surface = events.filter(e =>
      isSurfaceEvent(e) && e.surfaceOp !== undefined,
    )
    const fallback = events.filter(isSurfaceEvent)
    const chosen = surface.length > 0 ? surface : fallback
    if (chosen.length === 0) {
      return { detail: t('flow.dataflow.role.clientRender'), inputText: none, outputText: none }
    }
    return {
      detail: t('flow.dataflow.role.clientRender'),
      inputText: clip(chosen.map(summarizeSurfaceEvent).join('\n---\n')),
      outputText: clip(t('flow.dataflow.renderSettled')),
      organizedText: clip(pretty(chosen.map(e => ({
        type: e.type,
        seq: e.seq,
        surfaceOp: e.surfaceOp,
      })))),
    }
  }

  const stepStart = /^df:s(\d+):start$/.exec(id)
  if (stepStart !== null) {
    const step = Number(stepStart[1])
    const event = events.find(e => e.type === 'step/start' && e.data.step === step)
    return {
      detail: t('flow.dataflow.role.stepStart'),
      inputText: event?.type === 'step/start' ? clip(pretty(event.data)) : none,
      outputText: clip(pretty({ step })),
    }
  }

  const stepEnd = /^df:s(\d+):end$/.exec(id)
  if (stepEnd !== null) {
    const step = Number(stepEnd[1])
    const event = events.find(e => e.type === 'step/end' && e.data.step === step)
    return {
      detail: t('flow.dataflow.role.stepEnd'),
      inputText: event?.type === 'step/end' ? clip(pretty(event.data)) : none,
      outputText: event === undefined ? none : clip(pretty({ step, closed: true })),
    }
  }

  const stepRequest = /^df:s(\d+):request$/.exec(id)
  if (stepRequest !== null) {
    const step = Number(stepRequest[1])
    const stepEvents = eventsForStep(events, step)
    const header = stepEvents.find(e => e.type === 'request/header')
    const context = stepEvents.find(e => e.type === 'request/context')
    const inputs = stepEvents.filter(e =>
      e.type === 'user/message' || e.type === 'system/message',
    )
    if (header === undefined && inputs.length === 0) {
      return { detail: t('flow.dataflow.role.stepRequest'), inputText: none, outputText: none }
    }
    return {
      detail: t('flow.dataflow.role.stepRequest'),
      inputText: inputs.length > 0
        ? clip(inputs.map(summarizeSurfaceEvent).join('\n---\n'))
        : none,
      outputText: header?.type === 'request/header'
        ? clip(pretty({ reason: header.data.reason, config: header.data.header.config }))
        : none,
      organizedText: clip(pretty({
        step,
        header: header?.type === 'request/header' ? header.data : undefined,
        requestContext: context?.type === 'request/context' ? context.data : undefined,
        surfaceIn: inputs.map(e => ({ type: e.type, seq: e.seq })),
      })),
    }
  }

  const stepModel = /^df:s(\d+):model$/.exec(id)
  if (stepModel !== null) {
    const step = Number(stepModel[1])
    const stepEvents = eventsForStep(events, step)
    const header = stepEvents.find(e => e.type === 'request/header')
    const assistants = stepEvents.filter(e => e.type === 'assistant/message')
    const last = assistants[assistants.length - 1]
    return {
      detail: t('flow.dataflow.role.model'),
      inputText: header?.type === 'request/header'
        ? clip(pretty(header.data))
        : none,
      outputText: last?.type === 'assistant/message'
        ? clip(contentText(last.data.message.content))
        : none,
      ...(last?.type === 'assistant/message'
        ? { organizedText: clip(pretty(last.data.message)) }
        : {}),
    }
  }

  const stepTool = /^df:s(\d+):tool:(.+)$/.exec(id)
  if (stepTool !== null) {
    const callId = stepTool[2]!
    const call = events.find(e => e.type === 'tool/call' && e.data.callId === callId)
    const result = events.find(e => toolResultCallId(e) === callId)
    return {
      detail: t('flow.dataflow.role.tool'),
      inputText: call?.type === 'tool/call' ? clip(call.data.arguments) : none,
      outputText: result !== undefined ? clip(toolResultText(result)) : none,
      organizedText: clip(pretty({
        callId,
        name: call?.type === 'tool/call' ? call.data.name : undefined,
        arguments: call?.type === 'tool/call' ? call.data.arguments : undefined,
        result: result !== undefined ? toolResultText(result) : undefined,
        feedsNextStep: 'tool/result appends to Session surface for the next Step request',
      })),
    }
  }

  return { detail: id, inputText: none, outputText: none }
}

function eventsForStep(events: readonly SessionEvent[], step: number): SessionEvent[] {
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

function eventStep(event: SessionEvent): number | undefined {
  const data = event.data as { step?: number }
  return typeof data.step === 'number' ? data.step : undefined
}

function isUserSource(event: SessionEvent): boolean {
  return event.type === 'user/message' && event.data.source.kind === 'user'
}

function isSurfaceEvent(event: SessionEvent): boolean {
  return event.type === 'user/message'
    || event.type === 'assistant/message'
    || event.type === 'tool/result'
    || event.type === 'system/message'
}

function toolResultText(event: SessionEvent): string {
  if (event.type !== 'tool/result') return ''
  const data = event.data as {
    output?: string
    message?: { content: readonly ContentBlock[] }
  }
  if (typeof data.output === 'string') return data.output
  const block = data.message?.content.find(part => part.type === 'tool-result')
  if (block?.type === 'tool-result') return contentText(block.content)
  return pretty(event.data)
}

function summarizeSurfaceEvent(event: SessionEvent): string {
  switch (event.type) {
    case 'user/message':
      return `user/message#${event.seq}\n${contentText(event.data.content)}`
    case 'system/message':
      return `system/message#${event.seq}\n${contentText(event.data.message.content)}`
    case 'assistant/message':
      return `assistant/message#${event.seq}\n${contentText(event.data.message.content)}`
    case 'tool/result':
      return `tool/result#${event.seq}\n${toolResultText(event)}`
    default:
      return `${event.type}#${event.seq}`
  }
}

function contentText(content: readonly ContentBlock[]): string {
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
        parts.push(`[tool-result ${block.toolCallId}]\n${contentText(block.content)}`)
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

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function clip(text: string): string {
  return text.length <= DATAFLOW_IO_MAX ? text : `${text.slice(0, DATAFLOW_IO_MAX - 1)}…`
}
