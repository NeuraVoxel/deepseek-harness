/**
 * Events dimension: Turn-filtered SessionEvent timeline + payload pane data.
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import {
  collectTurnEvidence,
  durableEventsFromWindow,
  listEventsForTurn,
} from '../turn-evidence.ts'
import type {
  EventListEntry,
  EventListFilter,
  EventsDimensionView,
  FlowDimensionContext,
  FlowDimensionModule,
} from '../types.ts'

const SURFACE_TYPES = new Set([
  'user/message',
  'assistant/message',
  'system/message',
  'tool/result',
])

const CONTROL_TYPES = new Set([
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'request/header',
  'request/context',
  'tool/call',
  'agent-preset/selected',
])

/**
 * Map common event types onto process/skeleton node ids when obvious.
 * @param event - durable Session event.
 */
export function linkedNodeIdForEvent(event: SessionEvent): string | undefined {
  switch ((event as { type: string }).type) {
    case 'turn/start':
      return 'turn-start'
    case 'turn/end':
      return 'turn-end'
    case 'step/start':
      return 'step-start'
    case 'step/end':
      return 'step-end'
    case 'request/header':
    case 'request/context':
      return 'request'
    case 'assistant/message':
      return 'model'
    case 'tool/call':
    case 'tool/result':
      return 'tools'
    case 'user/message':
      return 'client'
    case 'agent-preset/selected':
      return 'preset'
    default:
      return undefined
  }
}

/**
 * @param ctx - shared dimension context.
 * @param filter - list chip filter (defaults to all; UI may re-derive).
 */
export function deriveEventsDimension(
  ctx: FlowDimensionContext,
  filter: EventListFilter = 'all',
): EventsDimensionView {
  const evidence = collectTurnEvidence(ctx.window, ctx.session, ctx.focusTurn)
  const inScope = listEventsForTurn(durableEventsFromWindow(ctx.window), evidence.turn)

  const entries: EventListEntry[] = []
  for (const event of inScope) {
    const bucket = classifyEvent(event.type)
    if (filter === 'surface' && bucket !== 'surface') continue
    if (filter === 'control' && bucket !== 'control') continue
    entries.push(toEntry(event))
  }

  const selected = entries.find(entry => entry.id === ctx.selection.eventId)
    ?? entries[entries.length - 1]
    ?? null

  return {
    kind: 'events',
    entries,
    selected,
    ...(selected?.linkedNodeId === undefined ? {} : { linkedNodeId: selected.linkedNodeId }),
    filter,
    blankDoubleClickToFleet: false,
  }
}

/**
 * Build the events dimension module. Filter is closed over; FlowPane passes
 * the latest chip via a thin wrapper when calling derive.
 */
export function createEventsDimension(
  getFilter: () => EventListFilter,
): FlowDimensionModule {
  return {
    id: 'events',
    labelKey: 'flow.dim.events',
    derive: (ctx) => deriveEventsDimension(ctx, getFilter()),
  }
}

/** Default events module (filter always `all`); tests and static registry use this. */
export const eventsDimension: FlowDimensionModule = {
  id: 'events',
  labelKey: 'flow.dim.events',
  derive: (ctx) => deriveEventsDimension(ctx, 'all'),
}

function classifyEvent(type: string): EventListFilter {
  if (SURFACE_TYPES.has(type)) return 'surface'
  if (CONTROL_TYPES.has(type)) return 'control'
  return 'all'
}

function toEntry(event: SessionEvent): EventListEntry {
  const data = event.data as Record<string, unknown>
  const turn = typeof data.turn === 'number' ? data.turn : null
  const step = typeof data.step === 'number' ? data.step : null
  const linkedNodeId = linkedNodeIdForEvent(event)
  return {
    id: `seq:${event.seq}`,
    seq: event.seq as number,
    type: event.type,
    turn,
    step,
    summary: summarize(event),
    payloadText: safeJson(event),
    ...(linkedNodeId === undefined ? {} : { linkedNodeId }),
  }
}

function summarize(event: SessionEvent): string {
  const data = event.data as Record<string, unknown>
  if (event.type === 'tool/call' && typeof data.name === 'string') {
    return `${event.type} · ${data.name}`
  }
  if (event.type === 'turn/end') {
    const reason = data.reason as { kind?: string } | undefined
    return reason?.kind !== undefined ? `${event.type} · ${reason.kind}` : event.type
  }
  if (typeof data.turn === 'number' && typeof data.step === 'number') {
    return `${event.type} · T${data.turn}/S${data.step}`
  }
  if (typeof data.turn === 'number') return `${event.type} · T${data.turn}`
  return event.type
}

function safeJson(event: SessionEvent): string {
  try {
    return JSON.stringify(event, null, 2)
  } catch {
    return String(event.type)
  }
}
