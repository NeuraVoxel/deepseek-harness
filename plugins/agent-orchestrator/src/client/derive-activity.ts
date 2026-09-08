/**
 * Derive which model tools are active on the current Session turn.
 * Used by the orchestrator composition canvas (not the observe flow graph).
 */

import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** Live composition activity for one Session. */
export interface CompositionActivity {
  /** Preset id the Session projection reports, or null when unknown. */
  readonly sessionPresetId: string | null
  /** Whether the Agent turn is running. */
  readonly sessionRunning: boolean
  /**
   * Tool names still in flight (tool/call without tool/result).
   * Empty when the Session is not running.
   */
  readonly runningToolNames: readonly string[]
  /**
   * Tool names seen on the latest turn (including finished ones).
   * While the Session is running these stay lit so short tools remain visible.
   */
  readonly turnToolNames: readonly string[]
}

const EMPTY: CompositionActivity = {
  sessionPresetId: null,
  sessionRunning: false,
  runningToolNames: [],
  turnToolNames: [],
}

/**
 * Project Session events + lifecycle into composition activity.
 * @param events - Client event window.
 * @param session - Session lifecycle snapshot.
 * @param sessionPresetId - optional agentPreset projection value.
 */
export function deriveCompositionActivity(
  events: SessionEventWindow,
  session: SessionSnapshot,
  sessionPresetId: string | null = null,
): CompositionActivity {
  const durable: SessionEvent[] = []
  for (const entry of events.entries) {
    if (entry.type === 'event') durable.push(entry.event)
  }

  const namesByCall = new Map<string, string>()
  const finished = new Set<string>()
  let latestTurnStartSeq = -1

  for (const event of durable) {
    if (event.type === 'turn/start') {
      latestTurnStartSeq = event.seq
      continue
    }
    if (event.type === 'tool/call') {
      namesByCall.set(String(event.data.callId), String(event.data.name))
      continue
    }
    if (event.type === 'assistant/message') {
      for (const part of event.data.message.content) {
        if (part.type !== 'tool-call') continue
        namesByCall.set(String(part.id), String(part.name))
      }
      continue
    }
    if (event.type === 'tool/result') {
      const block = event.data.message.content.find(part => part.type === 'tool-result')
      if (block === undefined || block.type !== 'tool-result') continue
      finished.add(String(block.toolCallId))
    }
  }

  const openNames = new Set<string>()
  for (const [callId, name] of namesByCall) {
    if (!finished.has(callId)) openNames.add(name)
  }

  const turnNames = new Set<string>()
  for (const event of durable) {
    if (latestTurnStartSeq >= 0 && event.seq < latestTurnStartSeq) continue
    if (event.type === 'tool/call') {
      turnNames.add(String(event.data.name))
      continue
    }
    if (event.type === 'assistant/message') {
      for (const part of event.data.message.content) {
        if (part.type === 'tool-call') turnNames.add(String(part.name))
      }
    }
  }
  // Only when the window has no turn/start: otherwise an empty latest turn
  // (text-only reply) must not inherit every tool from earlier turns.
  if (turnNames.size === 0 && latestTurnStartSeq < 0) {
    for (const name of namesByCall.values()) turnNames.add(name)
  }

  return {
    sessionPresetId,
    sessionRunning: session.running,
    runningToolNames: session.running ? [...openNames] : [],
    turnToolNames: session.running ? [...turnNames] : [],
  }
}

/** Empty activity used when no Session is bound. */
export function emptyCompositionActivity(): CompositionActivity {
  return EMPTY
}
