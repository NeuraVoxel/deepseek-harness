import { describe, expect, it } from 'vitest'
import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent, SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { emptyAgentFlow } from '../derive-flow.ts'
import { deriveEventsDimension, linkedNodeIdForEvent } from './events/index.ts'
import { deriveLoopDimension } from './loop/index.ts'
import { derivePanoramaDimension } from './panorama/index.ts'
import { deriveSeamDimension } from './seam/index.ts'
import { collectTurnEvidence } from './turn-evidence.ts'
import type { FlowDimensionContext } from './types.ts'

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
    hasMore: false,
    revision: 1,
    change: { kind: 'replace', entries: [] },
  } as SessionEventWindow
}

function completedTurn(): SessionEvent[] {
  return [
    {
      type: 'agent-preset/selected',
      seq: seq(0),
      time: 1,
      data: { agentPreset: 'standard' },
    },
    { type: 'turn/start', seq: seq(1), time: 2, data: { turn: 1 } },
    {
      type: 'user/message',
      seq: seq(2),
      time: 3,
      data: {
        id: 'u1',
        role: 'user',
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'user' },
      },
      surfaceOp: 'append',
    },
    { type: 'step/start', seq: seq(3), time: 4, data: { turn: 1, step: 1 } },
    {
      type: 'request/header',
      seq: seq(4),
      time: 5,
      data: {
        turn: 1,
        step: 1,
        reason: 'initial',
        header: { tools: [], call: {} },
      },
    },
    {
      type: 'assistant/message',
      seq: seq(5),
      time: 6,
      data: {
        turn: 1,
        step: 1,
        message: {
          id: 'a1',
          role: 'assistant',
          content: [{ type: 'text', text: 'ok' }],
          source: { kind: 'model', provider: 'mock', model: 'm1' },
        },
      },
      surfaceOp: 'append',
    },
    {
      type: 'tool/call',
      seq: seq(6),
      time: 7,
      data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' },
    },
    {
      type: 'tool/result',
      seq: seq(7),
      time: 8,
      data: {
        turn: 1,
        step: 1,
        callId: 'c1',
        name: 'bash',
        output: 'done',
        isError: false,
      },
      surfaceOp: 'append',
    },
    { type: 'step/end', seq: seq(8), time: 9, data: { turn: 1, step: 1 } },
    {
      type: 'turn/end',
      seq: seq(9),
      time: 10,
      data: { turn: 1, reason: { kind: 'completed' } },
    },
  ] as SessionEvent[]
}

function ctxOf(events: SessionEvent[], focusTurn: number | null = null): FlowDimensionContext {
  const window = windowOf(events)
  const session = sessionSnap()
  return {
    sessionId: sid('s1'),
    focusTurn,
    window,
    session,
    agentFlow: emptyAgentFlow(),
    selection: { nodeId: null, eventId: null },
    t: (key) => key,
  }
}

describe('collectTurnEvidence', () => {
  it('marks tool and preset evidence from a completed Turn', () => {
    const evidence = collectTurnEvidence(windowOf(completedTurn()), sessionSnap(), 1)
    expect(evidence.turnStarted).toBe(true)
    expect(evidence.turnEnded).toBe(true)
    expect(evidence.hasTool).toBe(true)
    expect(evidence.toolNames).toEqual(['bash'])
    expect(evidence.agentPreset).toBe('standard')
    expect(evidence.endReasonKind).toBe('completed')
  })
})

describe('skeleton overlays', () => {
  it('lights panorama nodes with evidence and leaves unused spur gray when unset', () => {
    const withoutPreset = completedTurn().filter(
      e => (e as { type: string }).type !== 'agent-preset/selected',
    )
    const view = derivePanoramaDimension(ctxOf(withoutPreset, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const byId = new Map(view.document.nodes.map(node => [node.id, node.status]))
    expect(byId.get('client')).toBe('done')
    expect(byId.get('model')).toBe('done')
    expect(byId.get('tools')).toBe('done')
    expect(byId.get('preset')).toBe('pending')
  })

  it('loop turn-end carries settle reason detail', () => {
    const view = deriveLoopDimension(ctxOf(completedTurn(), 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.inspectByNodeId?.get('turn-end')?.detail).toContain('completed')
  })

  it('seam tools provider stays pending without tool evidence', () => {
    const noTools = completedTurn().filter(e => e.type !== 'tool/call' && e.type !== 'tool/result')
    const view = deriveSeamDimension(ctxOf(noTools, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const toolsProvider = view.document.nodes.find(node => node.id === 'tools-provider')
    expect(toolsProvider?.status).toBe('pending')
  })
})

describe('events dimension', () => {
  it('filters by Turn and maps tool/call to tools node', () => {
    const view = deriveEventsDimension(ctxOf(completedTurn(), 1), 'control')
    expect(view.kind).toBe('events')
    if (view.kind !== 'events') return
    expect(view.entries.some(entry => entry.type === 'user/message')).toBe(false)
    expect(view.entries.some(entry => entry.type === 'tool/call')).toBe(true)
    expect(linkedNodeIdForEvent({
      type: 'tool/call',
      seq: seq(1),
      time: 1,
      data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' },
    } as SessionEvent)).toBe('tools')
  })

  it('selects linkedNodeId from the selected event', () => {
    const base = ctxOf(completedTurn(), 1)
    const listed = deriveEventsDimension(base, 'all')
    expect(listed.kind).toBe('events')
    if (listed.kind !== 'events') return
    const tool = listed.entries.find(entry => entry.type === 'tool/call')
    expect(tool?.linkedNodeId).toBe('tools')
    const focused = deriveEventsDimension({
      ...base,
      selection: { eventId: tool!.id, nodeId: null },
    }, 'all')
    expect(focused.kind).toBe('events')
    if (focused.kind !== 'events') return
    expect(focused.selected?.id).toBe(tool!.id)
    expect(focused.linkedNodeId).toBe('tools')
  })
})
