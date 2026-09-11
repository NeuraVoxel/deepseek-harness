/**
 * Conservative Turn evidence extracted from a Session event window.
 * Skeleton overlays light nodes only when these flags are true.
 */

import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { FlowNodeStatus } from '../derive-flow.ts'

/** Boolean / count evidence for one focused Turn. */
export interface TurnEvidence {
  readonly turn: number | null
  readonly latestTurn: number | null
  readonly turnStarted: boolean
  readonly turnEnded: boolean
  readonly turnError: boolean
  readonly hasUserInput: boolean
  readonly hasRequestHeader: boolean
  readonly hasAssistant: boolean
  readonly hasTool: boolean
  readonly hasRenderHint: boolean
  readonly stepCount: number
  readonly openStep: boolean
  readonly live: boolean
  readonly toolNames: readonly string[]
  readonly endReasonKind: string | null
  readonly agentPreset: string | undefined
}

/**
 * Fold durable events into overlay evidence for `focusTurn` or the Session latest.
 * @param window - Client Session event window.
 * @param session - Session lifecycle snapshot.
 * @param focusTurn - Pinned Turn, or null for latest.
 */
export function collectTurnEvidence(
  window: SessionEventWindow,
  session: SessionSnapshot,
  focusTurn: number | null,
): TurnEvidence {
  const durable: SessionEvent[] = []
  for (const entry of window.entries) {
    if (entry.type === 'event') durable.push(entry.event)
  }

  const latestTurn = findLatestTurn(durable)
  const turn = focusTurn ?? latestTurn
  const empty: TurnEvidence = {
    turn,
    latestTurn,
    turnStarted: false,
    turnEnded: false,
    turnError: false,
    hasUserInput: false,
    hasRequestHeader: false,
    hasAssistant: false,
    hasTool: false,
    hasRenderHint: false,
    stepCount: 0,
    openStep: false,
    live: session.running,
    toolNames: [],
    endReasonKind: null,
    agentPreset: undefined,
  }
  if (turn === null) return empty

  const inTurn = eventsInTurn(durable, turn)
  const turnEnded = inTurn.some(e => e.type === 'turn/end')
  const endEvent = inTurn.find(e => e.type === 'turn/end')
  const turnError = endEvent?.type === 'turn/end'
    && (endEvent.data.reason.kind === 'error' || endEvent.data.reason.kind === 'aborted')
  const stepStarts = inTurn.filter(e => e.type === 'step/start')
  const stepEnds = inTurn.filter(e => e.type === 'step/end')
  const toolNames = new Set<string>()
  for (const event of inTurn) {
    if (event.type === 'tool/call') toolNames.add(event.data.name)
  }

  let agentPreset: string | undefined
  for (const event of durable) {
    if ((event as { type: string }).type !== 'agent-preset/selected') continue
    const value = (event.data as { agentPreset?: unknown }).agentPreset
    if (typeof value === 'string') agentPreset = value
  }

  return {
    turn,
    latestTurn,
    turnStarted: inTurn.some(e => e.type === 'turn/start'),
    turnEnded,
    turnError,
    hasUserInput: inTurn.some(e => e.type === 'user/message')
      || (!turnEnded && session.pendingSubmissions.length > 0),
    hasRequestHeader: inTurn.some(e => e.type === 'request/header'),
    hasAssistant: inTurn.some(e => e.type === 'assistant/message'),
    hasTool: toolNames.size > 0,
    hasRenderHint: inTurn.some(e => e.type === 'assistant/message' || e.type === 'turn/end'),
    stepCount: stepStarts.length,
    openStep: stepStarts.length > stepEnds.length,
    live: session.running && !turnEnded,
    toolNames: [...toolNames],
    endReasonKind: endEvent?.type === 'turn/end' ? endEvent.data.reason.kind : null,
    agentPreset,
  }
}

/**
 * Map a boolean stage onto pending/active/done/error for skeleton nodes.
 * @param evidence - Turn evidence.
 * @param seen - Whether this stage has evidence.
 * @param options - When the stage is the current hotspot or failed with the turn.
 */
export function statusFromSeen(
  evidence: TurnEvidence,
  seen: boolean,
  options: { activeWhenLive?: boolean; errorWithTurn?: boolean } = {},
): FlowNodeStatus {
  if (options.errorWithTurn === true && evidence.turnError && seen) return 'error'
  if (!seen) return 'pending'
  if (options.activeWhenLive === true && evidence.live) return 'active'
  return evidence.turnEnded || !evidence.live ? 'done' : 'active'
}

function findLatestTurn(events: readonly SessionEvent[]): number | null {
  let latest: number | null = null
  for (const event of events) {
    if (event.type === 'turn/start' || event.type === 'turn/end') {
      const turn = event.data.turn
      if (latest === null || turn > latest) latest = turn
    }
  }
  return latest
}

function eventsInTurn(events: readonly SessionEvent[], turn: number): SessionEvent[] {
  let startSeq: number | undefined
  let endSeq: number | undefined
  for (const event of events) {
    if (event.type === 'turn/start' && event.data.turn === turn) startSeq = event.seq
    if (event.type === 'turn/end' && event.data.turn === turn) endSeq = event.seq
  }
  if (startSeq === undefined) return []
  return events.filter(event => {
    if (event.seq < startSeq!) return false
    if (endSeq !== undefined && event.seq > endSeq) return false
    return true
  })
}
