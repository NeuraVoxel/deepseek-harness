import { describe, expect, it } from 'vitest'
import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent, SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import { deriveAgentFlow } from '../derive-flow.ts'
import { deriveArchitectureDimension } from './architecture/index.ts'
import { deriveDataFlowDimension } from './dataflow/index.ts'
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
        header: {
          tools: [],
          call: {},
          config: { provider: 'mock', model: 'm1' },
        },
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
        message: {
          id: 'tr1',
          role: 'user',
          content: [{
            type: 'tool-result',
            toolCallId: 'c1',
            toolName: 'bash',
            content: [{ type: 'text', text: 'done' }],
            isError: false,
          }],
          source: { kind: 'tool', callId: 'c1' },
        },
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
    agentFlow: deriveAgentFlow(window, session, focusTurn),
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
    for (const group of view.document.groups ?? []) {
      expect(group.style?.label?.maxChars).toBe(0)
      expect(group.label.length).toBeGreaterThan(0)
      // Locale keys used as labels in this fixture exceed the old 18-char paint cap.
      expect(group.label.startsWith('flow.architecture.group.')).toBe(true)
      expect(group.label.length).toBeGreaterThan(18)
    }
    const e2e = view.document.groups!.find(g => g.id === 'g-e2e')!
    const loop = view.document.groups!.find(g => g.id === 'g-turn-loop')!
    // Outside topLeft labels need clearance between stacked bands.
    expect((loop.y ?? 0) - ((e2e.y ?? 0) + (e2e.h ?? 0))).toBeGreaterThanOrEqual(36)
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
      expect(summary.x).toBe((group.x ?? 0) + ((group.w ?? 0) - (summary.w ?? 0)) / 2)
      expect(summary.y).toBe((group.y ?? 0) + ((group.h ?? 0) - (summary.h ?? 0)) / 2)
    }
    const beads = view.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBeGreaterThan(1)
    const ordered = [...beads].sort((a, b) => Number(a.label) - Number(b.label))
    const start = ordered[0]!
    const end = ordered[ordered.length - 1]!
    const mid = ordered.slice(1, -1)
    expect(start.data?.endpoint).toBe('start')
    expect(start.data?.fill).toBe('#dc2626')
    expect(end.data?.endpoint).toBe('end')
    expect(end.data?.fill).toBe('#16a34a')
    expect(mid.every(node => node.w === 16 && node.data?.fill === '#f97316')).toBe(true)
    expect(beads.every(node =>
      node.label.length > 0
      && node.style?.labelPosition === 'center'
      && node.style?.label?.fontSize === 7
      && node.style?.label?.color === '#ffffff')).toBe(true)
    expect(beads.every(node => node.groupId === 'g-e2e')).toBe(true)
  })

  it('focusEventBeads keeps beads/seq edges opaque and dims other root chrome', () => {
    const view = deriveArchitectureDimension({
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
    expect(seqEdges.every(edge => edge.style?.alpha === 1 || edge.style?.alpha === undefined)).toBe(true)
    expect(otherEdges.every(edge => edge.style?.alpha === 0.2)).toBe(true)
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
    const arch = deriveArchitectureDimension(ctx)
    const listed = deriveEventsDimension(ctx, 'all')
    expect(arch.kind).toBe('graph')
    expect(listed.kind).toBe('events')
    if (arch.kind !== 'graph' || listed.kind !== 'events') return
    const beads = arch.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBe(listed.entries.length)
    expect(beads.some(node => node.data?.meta === 'system/message')).toBe(true)
    expect(new Set(beads.map(node => node.label))).toEqual(
      new Set(listed.entries.map(entry => String(entry.seq))),
    )
    const ordered = [...listed.entries].sort((a, b) => a.seq - b.seq)
    const seqEdges = arch.document.edges.filter(edge => edge.id.startsWith('event-seq:'))
    expect(seqEdges.map(edge => `${edge.from}->${edge.to}`)).toEqual(
      ordered.slice(0, -1).map((entry, index) => {
        const next = ordered[index + 1]!
        return `event:${entry.seq}->event:${next.seq}`
      }),
    )
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
    expect(bridges.every(edge => Array.isArray(edge.style?.strokeDash))).toBe(true)
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

describe('dataflow dimension', () => {
  it('builds E2E + real Step bands with Session payloads (not Process teaching prose)', () => {
    const view = deriveDataFlowDimension(ctxOf(completedTurn(), 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.legend).toBe('dataflow')
    expect(view.document.groups?.some(g => g.id === 'g-df-e2e')).toBe(true)
    expect(view.document.groups?.some(g => g.id === 'g-df-step-1')).toBe(true)
    expect(view.document.groups?.every(g => g.style?.label?.maxChars === 0)).toBe(true)
    expect(view.document.nodes.some(n => n.id === 'df:s1:start')).toBe(true)
    expect(view.document.nodes.some(n => n.id === 'df:s1:end')).toBe(true)
    expect(view.document.nodes.some(n => n.id === 'df:s1:model')).toBe(true)
    expect(view.document.edges.some(edge => edge.kind === 'data')).toBe(true)
    // Step-internal control edges stay so step/start…step/end remains a closed loop.
    expect(view.document.edges.some(edge =>
      edge.kind === 'flow' && edge.from === 'df:s1:start' && edge.to === 'df:s1:request',
    )).toBe(true)
    // E2E↔Step bridges stay hidden until the control-edge toggle.
    expect(view.document.edges.every(edge =>
      !(edge.kind === 'flow' && edge.from.startsWith('df:e2e:')),
    )).toBe(true)

    const client = view.inspectByNodeId!.get('df:e2e:client')
    expect(client?.inputText).toContain('hi')
    expect(client?.inputText).not.toContain('Typert Remote')

    const model = view.inspectByNodeId!.get('df:s1:model')
    expect(model?.outputText).toContain('ok')
    expect(model?.inputText).toContain('"reason": "initial"')
    expect(model?.inputText).not.toContain('llm.stream(GenerateOptions)')

    const tool = view.inspectByNodeId!.get('df:s1:tool:c1')
    expect(tool?.inputText).toContain('{}')
    expect(tool?.outputText).toContain('done')

    const request = view.inspectByNodeId!.get('df:s1:request')
    expect(request?.organizedText).toContain('"reason": "initial"')

    const render = view.inspectByNodeId!.get('df:e2e:render')
    expect(render?.organizedText).toContain('assistant/message')
    expect(render?.inputText).not.toContain('Typert Remote')
  })

  it('centers the Step trunk and fans tools above/below the Tools group slot', () => {
    const multiTool = [
      ...completedTurn().filter(event => event.type !== 'step/end' && event.type !== 'turn/end'),
      {
        type: 'tool/call',
        seq: seq(10),
        time: 11,
        data: { turn: 1, step: 1, callId: 'c2', name: 'grep', arguments: '{}' },
      },
      {
        type: 'tool/result',
        seq: seq(11),
        time: 12,
        data: {
          turn: 1,
          step: 1,
          message: {
            id: 'tr2',
            role: 'user',
            content: [{
              type: 'tool-result',
              toolCallId: 'c2',
              toolName: 'grep',
              content: [{ type: 'text', text: 'hit' }],
              isError: false,
            }],
            source: { kind: 'tool', callId: 'c2' },
          },
        },
        surfaceOp: 'append',
      },
      { type: 'step/end', seq: seq(12), time: 13, data: { turn: 1, step: 1 } },
      {
        type: 'turn/end',
        seq: seq(13),
        time: 14,
        data: { turn: 1, reason: { kind: 'completed' } },
      },
    ] as SessionEvent[]

    const view = deriveDataFlowDimension(ctxOf(multiTool, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.document.nodes.some(n => n.id === 'df:s1:tools')).toBe(false)
    expect(view.document.groups?.some(g => g.id === 'g-df-s1-tools')).toBe(true)
    const byId = new Map(view.document.nodes.map(n => [n.id, n]))
    const start = byId.get('df:s1:start')!
    const request = byId.get('df:s1:request')!
    const model = byId.get('df:s1:model')!
    const end = byId.get('df:s1:end')!
    const tool1 = byId.get('df:s1:tool:c1')!
    const tool2 = byId.get('df:s1:tool:c2')!
    expect(Math.abs((start.y! + start.h! / 2) - (request.y! + request.h! / 2))).toBeLessThan(2)
    expect(Math.abs((start.y! + start.h! / 2) - (model.y! + model.h! / 2))).toBeLessThan(2)
    expect(Math.abs((start.y! + start.h! / 2) - (end.y! + end.h! / 2))).toBeLessThan(2)
    expect(start.x!).toBeLessThan(request.x!)
    expect(request.x!).toBeLessThan(model.x!)
    expect(model.x!).toBeLessThan(end.x!)
    expect(tool1.groupId).toBe('g-df-s1-tools')
    expect(tool2.groupId).toBe('g-df-s1-tools')
    const trunkMidY = start.y! + start.h! / 2
    const toolsGroup = view.document.groups!.find(g => g.id === 'g-df-s1-tools')!
    expect(toolsGroup.expanded).toBe(true)
    const slotMidX = (toolsGroup.x ?? 0) + (toolsGroup.w ?? 0) / 2
    const t1cx = tool1.x! + tool1.w! / 2
    const t1cy = tool1.y! + tool1.h! / 2
    const t2cx = tool2.x! + tool2.w! / 2
    const t2cy = tool2.y! + tool2.h! / 2
    expect(t1cy).toBeLessThan(trunkMidY)
    expect(t2cy).toBeGreaterThan(trunkMidY)
    expect(Math.abs(t1cx - slotMidX)).toBeLessThan(8)
    expect(Math.abs(t2cx - slotMidX)).toBeLessThan(8)
    expect(view.document.edges.some(e =>
      e.from === 'df:s1:tool:c1' && e.to === 'df:e2e:write' && e.label === 'surface',
    )).toBe(true)
  })

  it('routes tool results into the next Step request', () => {
    const twoSteps: SessionEvent[] = [
      ...completedTurn().flatMap(event => {
        if (event.type === 'step/end' || event.type === 'turn/end') return []
        return [event]
      }),
      { type: 'step/end', seq: seq(12), time: 13, data: { turn: 1, step: 1 } } as SessionEvent,
      { type: 'step/start', seq: seq(13), time: 14, data: { turn: 1, step: 2 } } as SessionEvent,
      {
        type: 'request/header',
        seq: seq(14),
        time: 15,
        data: {
          turn: 1,
          step: 2,
          reason: 'change',
          header: {
            tools: [],
            call: {},
            config: { provider: 'mock', model: 'm1' },
          },
        },
      } as SessionEvent,
      {
        type: 'assistant/message',
        seq: seq(15),
        time: 16,
        data: {
          turn: 1,
          step: 2,
          message: {
            id: 'a2',
            role: 'assistant',
            content: [{ type: 'text', text: 'done2' }],
            source: { kind: 'model', provider: 'mock', model: 'm1' },
          },
        },
        surfaceOp: 'append',
      } as SessionEvent,
      { type: 'step/end', seq: seq(16), time: 17, data: { turn: 1, step: 2 } } as SessionEvent,
      {
        type: 'turn/end',
        seq: seq(17),
        time: 18,
        data: { turn: 1, reason: { kind: 'completed' } },
      } as SessionEvent,
    ]
    const view = deriveDataFlowDimension(ctxOf(twoSteps, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.document.nodes.some(n => n.id === 'df:s2:request')).toBe(true)
    expect(view.document.edges.some(e =>
      e.from === 'df:s1:tool:c1'
      && e.to === 'df:s2:request'
      && e.kind === 'data',
    )).toBe(true)
    expect(view.document.edges.some(e =>
      e.from === 'df:s1:end'
      && e.to === 'df:s2:request'
      && e.label === 'surface → next',
    )).toBe(true)
  })

  it('keeps control edges when showDataFlowControlEdges is true', () => {
    const view = deriveDataFlowDimension({
      ...ctxOf(completedTurn(), 1),
      showDataFlowControlEdges: true,
    })
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    expect(view.document.edges.some(edge => edge.kind === 'flow')).toBe(true)
    expect(view.document.nodes.some(n => n.id === 'df:turn:start')).toBe(true)
    expect(view.document.nodes.some(n => n.id === 'df:turn:end')).toBe(true)
  })

  it('overlays Turn event beads on Step-first anchors', () => {
    const view = deriveDataFlowDimension(ctxOf(completedTurn(), 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const beads = view.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBeGreaterThan(1)
    const byId = new Map(view.document.nodes.map(node => [node.id, node]))
    const turnStartBead = byId.get('event:1')
    const userBead = byId.get('event:2')
    const assistantBead = byId.get('event:5')
    const toolBead = byId.get('event:6')
    expect(turnStartBead).toBeDefined()
    expect(userBead).toBeDefined()
    expect(assistantBead).toBeDefined()
    expect(toolBead).toBeDefined()
    // Stem edges: bead from is the anchor.
    const stemOf = (beadId: string) =>
      view.document.edges.find(edge => edge.to === beadId && !edge.id.startsWith('event-seq:'))
    expect(stemOf('event:1')?.from).toBe('df:turn:start')
    expect(stemOf('event:2')?.from).toBe('df:e2e:client')
    expect(stemOf('event:5')?.from).toBe('df:s1:model')
    expect(stemOf('event:6')?.from).toBe('df:s1:tool:c1')
    expect(view.inspectByNodeId!.get('event:5')?.detail).toContain('assistant/message')
  })

  it('places Events without Turn/Step hosts on the E2E spine', () => {
    const base = completedTurn()
    const withoutEnd = base.slice(0, -1)
    const turnEnd = {
      ...base[base.length - 1]!,
      seq: seq(100),
      time: 100,
    }
    const withSystem = [
      ...withoutEnd,
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
      turnEnd,
    ] as SessionEvent[]
    const listed = deriveEventsDimension(ctxOf(withSystem, 1), 'all')
    const view = deriveDataFlowDimension(ctxOf(withSystem, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const beads = view.document.nodes.filter(node => node.type === 'event')
    expect(beads.length).toBe(listed.entries.length)
    const stemOf = (beadId: string) =>
      view.document.edges.find(edge => edge.to === beadId && !edge.id.startsWith('event-seq:'))
    expect(stemOf('event:50')?.from).toBe('df:e2e:write')
    expect(beads.some(node =>
      node.id === 'event:50' && node.groupId === 'g-df-e2e',
    )).toBe(true)
  })

  it('aligns DataFlow E2E fallbacks with Architecture panorama roles', () => {
    // No Step bands: force E2E-only hosts (turn brackets still present when turn starts).
    const e2eOnly: SessionEvent[] = [
      { type: 'turn/start', seq: seq(1), time: 1, data: { turn: 1 } },
      {
        type: 'user/message',
        seq: seq(2),
        time: 2,
        data: {
          id: 'u1',
          role: 'user',
          content: [{ type: 'text', text: 'hi' }],
          source: { kind: 'user' },
        },
        surfaceOp: 'append',
      },
      {
        type: 'request/header',
        seq: seq(3),
        time: 3,
        data: {
          turn: 1,
          step: 1,
          reason: 'initial',
          header: {
            tools: [],
            call: {},
            config: { provider: 'mock', model: 'm1' },
          },
        },
      },
      {
        type: 'turn/end',
        seq: seq(4),
        time: 4,
        data: { turn: 1, reason: { kind: 'completed' } },
      },
    ] as SessionEvent[]
    const view = deriveDataFlowDimension(ctxOf(e2eOnly, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const stemOf = (beadId: string) =>
      view.document.edges.find(edge => edge.to === beadId && !edge.id.startsWith('event-seq:'))
    // turn/end prefers Turn bracket when present; Architecture E2E role is admit.
    expect(stemOf('event:4')?.from === 'df:turn:end'
      || stemOf('event:4')?.from === 'df:e2e:admit').toBe(true)
    expect(stemOf('event:2')?.from).toBe('df:e2e:client')
    // request with no Step request node → session (Architecture envelope).
    expect(stemOf('event:3')?.from).toBe('df:e2e:session')
  })

  it('anchors multi-Step assistant beads on the owning Step model', () => {
    const twoSteps: SessionEvent[] = [
      ...completedTurn().flatMap(event => {
        if (event.type === 'step/end' || event.type === 'turn/end') return []
        return [event]
      }),
      { type: 'step/end', seq: seq(12), time: 13, data: { turn: 1, step: 1 } } as SessionEvent,
      { type: 'step/start', seq: seq(13), time: 14, data: { turn: 1, step: 2 } } as SessionEvent,
      {
        type: 'request/header',
        seq: seq(14),
        time: 15,
        data: {
          turn: 1,
          step: 2,
          reason: 'change',
          header: {
            tools: [],
            call: {},
            config: { provider: 'mock', model: 'm1' },
          },
        },
      } as SessionEvent,
      {
        type: 'assistant/message',
        seq: seq(15),
        time: 16,
        data: {
          turn: 1,
          step: 2,
          message: {
            id: 'a2',
            role: 'assistant',
            content: [{ type: 'text', text: 'done2' }],
            source: { kind: 'model', provider: 'mock', model: 'm1' },
          },
        },
        surfaceOp: 'append',
      } as SessionEvent,
      { type: 'step/end', seq: seq(16), time: 17, data: { turn: 1, step: 2 } } as SessionEvent,
      {
        type: 'turn/end',
        seq: seq(17),
        time: 18,
        data: { turn: 1, reason: { kind: 'completed' } },
      } as SessionEvent,
    ]
    const view = deriveDataFlowDimension(ctxOf(twoSteps, 1))
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const stemOf = (beadId: string) =>
      view.document.edges.find(edge => edge.to === beadId && !edge.id.startsWith('event-seq:'))
    expect(stemOf('event:5')?.from).toBe('df:s1:model')
    expect(stemOf('event:15')?.from).toBe('df:s2:model')
  })

  it('focusEventBeads dims DataFlow chrome while keeping beads opaque', () => {
    const view = deriveDataFlowDimension({
      ...ctxOf(completedTurn(), 1),
      focusEventBeads: true,
    })
    expect(view.kind).toBe('graph')
    if (view.kind !== 'graph') return
    const beads = view.document.nodes.filter(node => node.type === 'event')
    const stages = view.document.nodes.filter(node => node.type !== 'event')
    expect(beads.length).toBeGreaterThan(0)
    expect(beads.every(node => node.style?.alpha === 1)).toBe(true)
    expect(stages.every(node => node.style?.alpha === 0.2)).toBe(true)
    const seqEdges = view.document.edges.filter(edge => edge.id.startsWith('event-seq:'))
    expect(seqEdges.every(edge => edge.style?.alpha === 1 || edge.style?.alpha === undefined)).toBe(true)
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
