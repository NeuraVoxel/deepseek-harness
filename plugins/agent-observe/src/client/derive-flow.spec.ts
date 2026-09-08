import { describe, expect, it } from 'vitest'
import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent, SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { deriveAgentFlow } from './derive-flow.ts'

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

describe('deriveAgentFlow harness nodes', () => {
  it('emits Profile → Session → Envelope and per-step Memory → Context before Model', () => {
    const events = [
      {
        type: 'agent-preset/selected',
        seq: seq(0),
        time: 1,
        data: { agentPreset: 'standard' },
      },
      {
        type: 'turn/start',
        seq: seq(1),
        time: 2,
        data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user' } } },
      },
      {
        type: 'user/message',
        seq: seq(2),
        time: 3,
        data: {
          id: 'u1',
          role: 'user',
          content: [{ type: 'text', text: 'hello' }],
          source: { kind: 'user' },
        },
        surfaceOp: 'append',
      },
      {
        type: 'step/start',
        seq: seq(3),
        time: 4,
        data: { turn: 1, step: 1 },
      },
      {
        type: 'user/message',
        seq: seq(4),
        time: 5,
        data: {
          id: 'ctx1',
          role: 'user',
          content: [{ type: 'text', text: 'AGENTS.md baseline' }],
          source: { kind: 'plugin', plugin: 'agent-instructions', form: 'instructions' },
        },
        surfaceOp: 'append',
      },
      {
        type: 'request/header',
        seq: seq(5),
        time: 6,
        data: {
          reason: 'initial',
          header: {
            config: { provider: 'mock', model: 'm1' },
            system: 'You are helpful.',
            tools: [{ name: 'bash', description: 'shell', parameters: {} }],
          },
        },
      },
      {
        type: 'assistant/message',
        seq: seq(6),
        time: 7,
        data: {
          turn: 1,
          step: 1,
          message: {
            id: 'a1',
            role: 'assistant',
            content: [{ type: 'text', text: 'hi' }],
            source: { kind: 'model', provider: 'mock', model: 'm1' },
          },
        },
        surfaceOp: 'append',
      },
      {
        type: 'step/end',
        seq: seq(7),
        time: 8,
        data: { turn: 1, step: 1 },
      },
      {
        type: 'turn/end',
        seq: seq(8),
        time: 9,
        data: { turn: 1, reason: { kind: 'completed' } },
      },
    ] as SessionEvent[]

    const flow = deriveAgentFlow(windowOf(events), sessionSnap())
    const kinds = flow.nodes.map(n => n.kind)
    expect(kinds).toEqual([
      'profile',
      'session',
      'envelope',
      'client-input',
      'remote-prompt',
      'host-admit',
      'memory',
      'context',
      'model',
      'remote-follow',
      'client-render',
    ])
    expect(flow.nodes.find(n => n.kind === 'envelope')?.detail).toContain('preset=standard')
    expect(flow.agentPreset).toBe('standard')
    expect(flow.clientSurface).toBe('cli')
    expect(flow.nodes.find(n => n.kind === 'client-input')?.label).toBe('CLI input')
    expect(flow.nodes.find(n => n.kind === 'host-admit')?.detail).toBe('SessionController')
    expect(flow.nodes.find(n => n.kind === 'remote-prompt')?.label).toBe('session.prompt')
    expect(flow.nodes.find(n => n.kind === 'remote-follow')?.label).toBe('session.follow')
    expect(flow.nodes.find(n => n.kind === 'envelope')?.detail).toContain('tools=1')
    expect(flow.nodes.find(n => n.kind === 'context')?.detail).toContain('header')
    expect(flow.nodes.find(n => n.kind === 'context')?.detail).toContain('1 inject')
    expect(flow.nodes.find(n => n.kind === 'host-admit')?.label).toBe('Host admit')
    expect(flow.nodes.some(n => n.kind === 'client-input' && n.label.includes('AGENTS'))).toBe(false)

    expect(flow.edges).toEqual(expect.arrayContaining([
      { from: 'profile:s1', to: 'session:s1', kind: 'flow' },
      { from: 'session:s1', to: 'envelope:1', kind: 'data' },
      { from: 'input:2', to: 'remote-prompt:1', kind: 'data' },
      { from: 'remote-prompt:1', to: 'admit:1', kind: 'data', label: 'session.prompt' },
      { from: 'admit:1', to: 'context:1:1', kind: 'flow' },
      { from: 'memory:1:1', to: 'context:1:1', kind: 'data' },
      { from: 'envelope:1', to: 'context:1:1', kind: 'data' },
      { from: 'context:1:1', to: 'model:1:1', kind: 'data' },
      { from: 'model:1:1', to: 'session:s1', kind: 'data' },
      { from: 'session:s1', to: 'remote-follow:1', kind: 'data' },
      { from: 'model:1:1', to: 'remote-follow:1', kind: 'data', label: 'assistant' },
      { from: 'remote-follow:1', to: 'client-render:1', kind: 'data', label: 'session.follow' },
    ]))
    expect(flow.edges.some(e => e.from === 'admit:1' && e.to.startsWith('memory:'))).toBe(false)
    expect(flow.edges.some(e => e.from === 'session:s1' && e.to.startsWith('input:'))).toBe(false)
    expect(flow.edges.some(e =>
      e.from.startsWith('model:') && e.to.startsWith('client-render:'),
    )).toBe(false)
  })

  it('keeps Memory honest when compaction summary is present', () => {
    const events = [
      {
        type: 'turn/start',
        seq: seq(0),
        time: 1,
        data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user' } } },
      },
      {
        type: 'user/message',
        seq: seq(1),
        time: 2,
        data: {
          id: 'u1',
          role: 'user',
          content: [{ type: 'text', text: 'go' }],
          source: { kind: 'user' },
        },
        surfaceOp: 'append',
      },
      {
        type: 'compaction/start',
        seq: seq(2),
        time: 3,
        data: { compactionId: 'c1', turn: 1 },
      },
      {
        type: 'user/message',
        seq: seq(3),
        time: 4,
        data: {
          id: 'sum',
          role: 'user',
          content: [{ type: 'text', text: 'summary of prior work' }],
          source: { kind: 'plugin', plugin: 'compact' },
        },
        surfaceOp: { op: 'replace', start: 0, end: 0 },
      },
      {
        type: 'compaction/end',
        seq: seq(4),
        time: 5,
        data: { compactionId: 'c1' },
      },
      {
        type: 'step/start',
        seq: seq(5),
        time: 6,
        data: { turn: 1, step: 1 },
      },
      {
        type: 'assistant/message',
        seq: seq(6),
        time: 7,
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
        type: 'step/end',
        seq: seq(7),
        time: 8,
        data: { turn: 1, step: 1 },
      },
      {
        type: 'turn/end',
        seq: seq(8),
        time: 9,
        data: { turn: 1, reason: { kind: 'completed' } },
      },
    ] as SessionEvent[]

    const memory = deriveAgentFlow(windowOf(events), sessionSnap()).nodes.find(n => n.kind === 'memory')
    expect(memory?.detail).toContain('compaction')
    expect(memory?.outputText).toContain('summary of prior work')
  })

  it('labels Web input when user source carries clientTimeZone', () => {
    const events = [
      {
        type: 'turn/start',
        seq: seq(0),
        time: 1,
        data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user' } } },
      },
      {
        type: 'user/message',
        seq: seq(1),
        time: 2,
        data: {
          id: 'u1',
          role: 'user',
          content: [{ type: 'text', text: 'from browser' }],
          source: { kind: 'user', rpcId: 'r1', clientTimeZone: 'Asia/Shanghai' },
        },
        surfaceOp: 'append',
      },
      {
        type: 'step/start',
        seq: seq(2),
        time: 3,
        data: { turn: 1, step: 1 },
      },
      {
        type: 'step/end',
        seq: seq(3),
        time: 4,
        data: { turn: 1, step: 1 },
      },
      {
        type: 'turn/end',
        seq: seq(4),
        time: 5,
        data: { turn: 1, reason: { kind: 'completed' } },
      },
    ] as SessionEvent[]

    const flow = deriveAgentFlow(windowOf(events), sessionSnap())
    expect(flow.clientSurface).toBe('web')
    expect(flow.nodes.find(n => n.kind === 'client-input')?.label).toBe('Web input')
  })
})

/** Minimal completed turn with distinct user/assistant text for focusTurn cases. */
function completedTurn(args: {
  turn: number
  startSeq: number
  userText: string
  assistantText: string
}): SessionEvent[] {
  const { turn, startSeq: s, userText, assistantText } = args
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

describe('deriveAgentFlow focusTurn', () => {
  const twoTurns = [
    ...completedTurn({
      turn: 1,
      startSeq: 0,
      userText: 'first question',
      assistantText: 'first answer',
    }),
    ...completedTurn({
      turn: 2,
      startSeq: 10,
      userText: 'second question',
      assistantText: 'second answer',
    }),
  ]

  it('pins Turn 1 while Turn 2 is latest', () => {
    const flow = deriveAgentFlow(windowOf(twoTurns), sessionSnap(), 1)
    expect(flow.turn).toBe(1)
    expect(flow.latestTurn).toBe(2)
    expect(flow.nodes.every(n => n.turn === 1)).toBe(true)
    expect(flow.nodes.find(n => n.kind === 'client-input')?.detail).toContain('first question')
    expect(flow.nodes.find(n => n.kind === 'model')?.outputText).toContain('first answer')
    expect(flow.nodes.some(n =>
      (n.detail?.includes('second') ?? false) || n.outputText.includes('second'),
    )).toBe(false)
  })

  it('null or omitted focusTurn folds the latest Turn', () => {
    const omitted = deriveAgentFlow(windowOf(twoTurns), sessionSnap())
    expect(omitted.turn).toBe(2)
    expect(omitted.latestTurn).toBe(2)
    expect(omitted.nodes.find(n => n.kind === 'client-input')?.detail).toContain('second question')

    const explicitNull = deriveAgentFlow(windowOf(twoTurns), sessionSnap(), null)
    expect(explicitNull.turn).toBe(2)
    expect(explicitNull.latestTurn).toBe(2)
    expect(explicitNull.nodes.find(n => n.kind === 'model')?.outputText).toContain('second answer')
  })

  it('missing focusTurn yields an empty placeholder without retargeting', () => {
    const flow = deriveAgentFlow(windowOf(twoTurns), sessionSnap(), 99)
    expect(flow.turn).toBe(99)
    expect(flow.latestTurn).toBe(2)
    expect(flow.nodes).toEqual([])
    expect(flow.edges).toEqual([])
  })

  it('pinned ended Turn settles even when Session is running a newer Turn', () => {
    const liveTurn2 = [
      ...completedTurn({
        turn: 1,
        startSeq: 0,
        userText: 'first question',
        assistantText: 'first answer',
      }),
      {
        type: 'turn/start',
        seq: seq(10),
        time: 10,
        data: { turn: 2, trigger: { kind: 'message', source: { kind: 'user' } } },
      },
      {
        type: 'user/message',
        seq: seq(11),
        time: 11,
        data: {
          id: 'u2',
          role: 'user',
          content: [{ type: 'text', text: 'second question' }],
          source: { kind: 'user' },
        },
        surfaceOp: 'append',
      },
      {
        type: 'step/start',
        seq: seq(12),
        time: 12,
        data: { turn: 2, step: 1 },
      },
    ] as SessionEvent[]

    const flow = deriveAgentFlow(windowOf(liveTurn2), sessionSnap({ running: true }), 1)
    expect(flow.turn).toBe(1)
    expect(flow.latestTurn).toBe(2)
    expect(flow.running).toBe(true)
    expect(flow.nodes.length).toBeGreaterThan(0)
    expect(flow.nodes.every(n => n.turn === 1)).toBe(true)
    // Ended Turn must not pick up live-active from Session.running on a newer Turn.
    expect(flow.nodes.some(n => n.status === 'active')).toBe(false)
    expect(flow.nodes.find(n => n.kind === 'client-render')?.status).toBe('done')
    expect(flow.nodes.find(n => n.kind === 'model')?.status).toBe('done')
  })
})
