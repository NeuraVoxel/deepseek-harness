import { describe, expect, it } from 'vitest'
import type { SessionEventWindow } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { resolveTurnFromMessageId } from './resolve-turn.ts'

function seq(value: number): SessionSeq {
  return value as SessionSeq
}

function windowOf(events: SessionEvent[]): SessionEventWindow {
  return {
    entries: events.map(event => ({ type: 'event' as const, event })),
  } as unknown as SessionEventWindow
}

function twoTurnWindow(): SessionEventWindow {
  return windowOf([
    {
      type: 'assistant/message',
      seq: seq(1),
      time: 1,
      data: {
        turn: 1,
        step: 1,
        message: {
          id: 'a1',
          role: 'assistant',
          content: [{ type: 'text', text: 'first' }],
          source: { kind: 'model', provider: 'mock', model: 'm1' },
        },
      },
      surfaceOp: 'append',
    },
    {
      type: 'assistant/message',
      seq: seq(2),
      time: 2,
      data: {
        turn: 2,
        step: 1,
        message: {
          id: 'a2',
          role: 'assistant',
          content: [{ type: 'text', text: 'second' }],
          source: { kind: 'model', provider: 'mock', model: 'm1' },
        },
      },
      surfaceOp: 'append',
    },
  ] as SessionEvent[])
}

describe('resolveTurnFromMessageId', () => {
  it('returns the Turn number for a known assistant message id', () => {
    const window = twoTurnWindow()
    expect(resolveTurnFromMessageId(window, 'a1')).toBe(1)
    expect(resolveTurnFromMessageId(window, 'a2')).toBe(2)
  })

  it('returns undefined for an unknown message id', () => {
    expect(resolveTurnFromMessageId(twoTurnWindow(), 'missing')).toBeUndefined()
  })

  it('returns undefined for an empty window', () => {
    expect(resolveTurnFromMessageId(windowOf([]), 'a1')).toBeUndefined()
  })
})
