import { describe, expect, it } from 'vitest'
import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent, SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { emptyAgentFlow } from '../derive-flow.ts'
import { deriveArchitectureDimension } from './architecture/index.ts'
import { deriveIntegratedDimension } from './integrated/index.ts'
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
    const tools = view.document.nodes.find(node => node.id === 'tools')
    expect(tools?.w).toBe(56)
    expect(tools?.h).toBe(56)
    expect(tools?.data?.shape).toBe('circle')
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

describe('integrated atlas', () => {
  it('groups panorama with SubNetwork gates and event beads', () => {
    const view = deriveIntegratedDimension(ctxOf(completedTurn(), 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.legend).toBe('integrated')
    expect(view.document.networks?.['net:loop']).toBeDefined()
    expect(view.document.networks?.['net:seam']).toBeDefined()
    const loopGate = view.document.nodes.find(node => node.id === 'gate:loop')
    expect(loopGate?.networkId).toBe('net:loop')
    const beads = view.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBeGreaterThan(1)
    const ordered = [...beads].sort((a, b) => Number(a.label) - Number(b.label))
    const start = ordered[0]!
    const end = ordered[ordered.length - 1]!
    const mid = ordered.slice(1, -1)
    expect(start.data?.endpoint).toBe('start')
    expect(start.data?.fill).toBe('#dc2626')
    expect(start.w).toBe(16)
    expect(start.label2).toBeUndefined()
    expect(end.data?.endpoint).toBe('end')
    expect(end.data?.fill).toBe('#16a34a')
    expect(end.w).toBe(16)
    expect(end.label2).toBeUndefined()
    expect(mid.every(node => node.w === 16 && node.data?.fill === '#f97316')).toBe(true)
    expect(beads.every(node =>
      node.label.length > 0
      && node.style?.labelPosition === 'center'
      && node.style?.label?.fontSize === 7
      && node.style?.label?.color === '#ffffff')).toBe(true)
    const seqEdges = view.document.edges.filter(edge => edge.id.startsWith('event-seq:'))
    expect(seqEdges.length).toBe(Math.max(0, beads.length - 1))
    expect(seqEdges.every(edge => Array.isArray(edge.data?.strokeDash))).toBe(true)
    expect(view.document.groups?.map(group => group.id)).toEqual([
      'g-panorama', 'g-loop', 'g-seam',
    ])
  })

  it('focusEventBeads keeps beads/seq edges opaque and dims other root chrome', () => {
    const view = deriveIntegratedDimension({
      ...ctxOf(completedTurn(), 1),
      focusEventBeads: true,
    })
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const beads = view.document.nodes.filter(node => node.type === 'event')
    const stages = view.document.nodes.filter(node => node.type !== 'event')
    expect(beads.length).toBeGreaterThan(0)
    expect(beads.every(node => node.style?.alpha === 1 && node.style?.showIcon === false)).toBe(true)
    expect(stages.every(node => node.style?.alpha === 0.2 && node.style?.showIcon === false)).toBe(true)
    const seqEdges = view.document.edges.filter(edge => edge.id.startsWith('event-seq:'))
    const otherEdges = view.document.edges.filter(edge => !edge.id.startsWith('event-seq:'))
    expect(seqEdges.every(edge => typeof edge.data?.stroke === 'string'
      && !String(edge.data.stroke).includes('0.2'))).toBe(true)
    expect(otherEdges.every(edge => String(edge.data?.stroke).includes('0.2'))).toBe(true)
  })

  it('places one bead per Events-tab Turn event (filter all)', () => {
    const base = completedTurn()
    const beforeEnd = base.slice(0, -1)
    const turnEnd = {
      ...base[base.length - 1]!,
      seq: seq(100),
      time: 100,
    }
    const extras = [
      {
        type: 'system/message',
        seq: seq(50),
        time: 50,
        data: {
          turn: 1,
          step: 1,
          message: {
            id: 'sys1',
            role: 'system',
            content: [{ type: 'text', text: 'note' }],
            source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt' },
          },
        },
        surfaceOp: 'append',
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        type: 'tool/call' as const,
        seq: seq(60 + index),
        time: 60 + index,
        data: {
          turn: 1,
          step: 1,
          callId: `c-extra-${index}`,
          name: 'bash',
          arguments: '{}',
        },
      })),
    ] as SessionEvent[]
    const ctx = ctxOf([...beforeEnd, ...extras, turnEnd], 1)
    const atlas = deriveIntegratedDimension(ctx)
    const listed = deriveEventsDimension(ctx, 'all')
    expect(atlas.kind).toBe('graph')
    expect(listed.kind).toBe('events')
    if (atlas.kind !== 'graph' || listed.kind !== 'events') return
    const beads = atlas.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBe(listed.entries.length)
    expect(beads.some(node => node.data?.meta === 'system/message')).toBe(true)
    expect(new Set(beads.map(node => node.label))).toEqual(
      new Set(listed.entries.map(entry => String(entry.seq))),
    )
    const ordered = [...listed.entries].sort((a, b) => a.seq - b.seq)
    const seqEdges = atlas.document.edges.filter(edge => edge.id.startsWith('event-seq:'))
    expect(seqEdges.map(edge => `${edge.from}->${edge.to}`)).toEqual(
      ordered.slice(0, -1).map((entry, index) => {
        const next = ordered[index + 1]!
        return `event:${entry.seq}->event:${next.seq}`
      }),
    )
  })
})

describe('architecture dimension', () => {
  it('defaults to SubNetwork gateways for Turn-loop and Capability-seam Groups', () => {
    const view = deriveArchitectureDimension(ctxOf(completedTurn(), 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.legend).toBe('architecture')
    expect(view.document.networks?.['net:loop']).toBeDefined()
    expect(view.document.networks?.['net:seam']).toBeDefined()
    expect(view.document.groups?.map(group => group.id)).toEqual([
      'g-e2e', 'g-turn-loop', 'g-seam',
    ])
    const loopGate = view.document.nodes.find(node => node.id === 'loop:summary')
    const seamGate = view.document.nodes.find(node => node.id === 'seam:summary')
    expect(loopGate?.type).toBe('gateway')
    expect(loopGate?.networkId).toBe('net:loop')
    expect(seamGate?.type).toBe('gateway')
    expect(seamGate?.networkId).toBe('net:seam')
    expect(view.document.nodes.every(node =>
      (!node.id.startsWith('loop:') || node.id === 'loop:summary')
      && (!node.id.startsWith('seam:') || node.id === 'seam:summary'),
    )).toBe(true)
    expect(view.document.edges.every(edge => !edge.id.startsWith('bridge:'))).toBe(true)
    for (const id of ['loop:summary', 'seam:summary'] as const) {
      const summary = view.document.nodes.find(node => node.id === id)!
      const groupId = id === 'loop:summary' ? 'g-turn-loop' : 'g-seam'
      const group = view.document.groups?.find(g => g.id === groupId)!
      expect(summary.x).toBe(group.x + (group.w - summary.w) / 2)
      expect(summary.y).toBe(group.y + (group.h - summary.h) / 2)
    }
    const beads = view.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBeGreaterThan(0)
    expect(beads.every(node => node.groupId === 'g-e2e')).toBe(true)
  })

  it('inlines Turn-loop nodes and scope bridges when expand is true', () => {
    const view = deriveArchitectureDimension({
      ...ctxOf(completedTurn(), 1),
      expandArchitectureLoop: true,
    })
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.document.networks?.['net:loop']).toBeDefined()
    expect(view.document.nodes.some(node => node.id === 'model')).toBe(true)
    expect(view.document.nodes.some(node => node.id === 'loop:model')).toBe(true)
    expect(view.document.nodes.every(node => node.id !== 'loop:summary')).toBe(true)
    expect(view.document.nodes.some(node => node.id === 'seam:summary')).toBe(true)
    const bridges = view.document.edges.filter(edge => edge.id.startsWith('bridge:'))
    expect(bridges.length).toBe(4)
    expect(bridges.every(edge => Array.isArray(edge.data?.strokeDash))).toBe(true)
    const beads = view.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBeGreaterThan(1)
    expect(beads.some(node => node.groupId === 'g-turn-loop')).toBe(true)
    const stemToLoop = view.document.edges.some(edge =>
      edge.to.startsWith('event:') && edge.from.startsWith('loop:'),
    )
    expect(stemToLoop).toBe(true)
  })

  it('inlines Capability-seam nodes when expandSeam is true', () => {
    const view = deriveArchitectureDimension({
      ...ctxOf(completedTurn(), 1),
      expandArchitectureSeam: true,
    })
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.document.nodes.some(node => node.id === 'seam:def')).toBe(true)
    expect(view.document.nodes.some(node => node.id === 'seam:tools-consumer')).toBe(true)
    expect(view.document.nodes.every(node => node.id !== 'seam:summary')).toBe(true)
    expect(view.document.nodes.some(node => node.id === 'loop:summary')).toBe(true)
    const seamBridges = view.document.edges.filter(edge =>
      edge.id.startsWith('bridge:') && edge.to.startsWith('seam:'),
    )
    expect(seamBridges.length).toBe(3)
  })

  it('focusArchitectureE2e hides event beads and event edges', () => {
    const withEvents = deriveArchitectureDimension(ctxOf(completedTurn(), 1))
    const focused = deriveArchitectureDimension({
      ...ctxOf(completedTurn(), 1),
      focusArchitectureE2e: true,
    })
    expect(withEvents.kind).toBe('graph')
    expect(focused.kind).toBe('graph')
    if (withEvents.kind !== 'graph' || focused.kind !== 'graph') return
    expect(withEvents.document.nodes.some(node => node.type === 'event')).toBe(true)
    expect(focused.document.nodes.every(node => node.type !== 'event')).toBe(true)
    expect(focused.document.edges.every(edge =>
      !edge.id.startsWith('event-seq:')
      && !edge.id.includes('->event:')
      && !edge.to.startsWith('event:'),
    )).toBe(true)
    expect(focused.document.nodes.some(node => node.id === 'client')).toBe(true)
    expect(focused.document.nodes.some(node => node.id === 'loop:summary')).toBe(true)
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
