import { describe, expect, it, vi } from 'vitest'
import type { SessionBinding, SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent, SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { createAgentFlowSource } from './flow-source.ts'
import { createObserveNavStore } from './nav-store.ts'

function sid(value: string): SessionId {
  return value as SessionId
}

function seq(value: number): SessionSeq {
  return value as SessionSeq
}

function sessionSnap(partial: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    sessionId: sid('s1'),
    queue: [],
    pendingSubmissions: [],
    running: false,
    subagent: null,
    removed: false,
    openState: 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
    promptAttempted: true,
    awaitingFirstTurn: false,
    ...partial,
  } as SessionSnapshot
}

function windowOf(events: SessionEvent[]): SessionEventWindow {
  return {
    entries: events.map(event => ({ type: 'event' as const, event })),
  } as unknown as SessionEventWindow
}

function completedTurn(turn: number, startSeq: number, userText: string, assistantText: string): SessionEvent[] {
  const s = startSeq
  return [
    {
      type: 'turn/start',
      seq: seq(s),
      time: s,
      data: { turn, trigger: { kind: 'message', source: { kind: 'user' } } },
    },
    {
      type: 'user/message',
      seq: seq(s + 1),
      time: s + 1,
      data: {
        id: `u${turn}`,
        role: 'user',
        content: [{ type: 'text', text: userText }],
        source: { kind: 'user' },
      },
      surfaceOp: 'append',
    },
    {
      type: 'step/start',
      seq: seq(s + 2),
      time: s + 2,
      data: { turn, step: 1 },
    },
    {
      type: 'assistant/message',
      seq: seq(s + 3),
      time: s + 3,
      data: {
        turn,
        step: 1,
        message: {
          id: `a${turn}`,
          role: 'assistant',
          content: [{ type: 'text', text: assistantText }],
          source: { kind: 'model', provider: 'mock', model: 'm1' },
        },
      },
      surfaceOp: 'append',
    },
    {
      type: 'step/end',
      seq: seq(s + 4),
      time: s + 4,
      data: { turn, step: 1 },
    },
    {
      type: 'turn/end',
      seq: seq(s + 5),
      time: s + 5,
      data: { turn, reason: { kind: 'completed' } },
    },
  ] as SessionEvent[]
}

function fakeBinding(window: SessionEventWindow, session: SessionSnapshot): SessionBinding {
  const eventListeners = new Set<() => void>()
  const sessionListeners = new Set<() => void>()
  return {
    sessionId: session.sessionId,
    eventSource: {
      getSnapshot: () => window,
      subscribe: (fn: () => void) => {
        eventListeners.add(fn)
        return () => { eventListeners.delete(fn) }
      },
    },
    session: {
      getSnapshot: () => session,
      subscribe: (fn: () => void) => {
        sessionListeners.add(fn)
        return () => { sessionListeners.delete(fn) }
      },
    },
  } as unknown as SessionBinding
}

describe('createAgentFlowSource', () => {
  it('re-projects when nav focusTurn changes', () => {
    const events = [
      ...completedTurn(1, 0, 'first question', 'first answer'),
      ...completedTurn(2, 10, 'second question', 'second answer'),
    ]
    const binding = fakeBinding(windowOf(events), sessionSnap())
    const nav = createObserveNavStore().create('s1')
    const source = createAgentFlowSource(binding, nav)

    expect(source.getSnapshot().turn).toBe(2)

    const listener = vi.fn()
    source.subscribe(listener)
    nav.actions.showFlow(1)

    expect(listener).toHaveBeenCalledTimes(1)
    const flow = source.getSnapshot()
    expect(flow.turn).toBe(1)
    expect(flow.latestTurn).toBe(2)
    expect(flow.nodes.find(n => n.kind === 'client-input')?.detail).toContain('first question')
  })
})
