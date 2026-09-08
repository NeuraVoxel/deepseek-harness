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
      'host-admit',
      'memory',
      'context',
      'step',
      'model',
      'turn-end',
      'client-render',
    ])
    expect(flow.nodes.find(n => n.kind === 'envelope')?.detail).toContain('preset=standard')
    expect(flow.nodes.find(n => n.kind === 'envelope')?.detail).toContain('tools=1')
    expect(flow.nodes.find(n => n.kind === 'context')?.detail).toContain('header')
    expect(flow.nodes.find(n => n.kind === 'context')?.detail).toContain('1 inject')
    expect(flow.nodes.some(n => n.kind === 'client-input' && n.label.includes('AGENTS'))).toBe(false)

    expect(flow.edges).toEqual(expect.arrayContaining([
      { from: 'profile:s1', to: 'session:s1', kind: 'flow' },
      { from: 'session:s1', to: 'envelope:1', kind: 'flow' },
      { from: 'session:s1', to: 'input:2', kind: 'flow' },
      { from: 'admit:1', to: 'context:1:1', kind: 'flow' },
      { from: 'memory:1:1', to: 'context:1:1', kind: 'data' },
      { from: 'envelope:1', to: 'context:1:1', kind: 'data' },
      { from: 'context:1:1', to: 'step:1:1', kind: 'flow' },
      { from: 'step:1:1', to: 'model:1:1', kind: 'flow' },
    ]))
    expect(flow.edges.some(e => e.from === 'admit:1' && e.to.startsWith('memory:'))).toBe(false)
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
})
