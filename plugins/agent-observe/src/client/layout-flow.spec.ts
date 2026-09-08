import { describe, expect, it } from 'vitest'
import type { AgentFlowSnapshot } from './derive-flow.ts'
import { buildColumns, layoutAgentFlow } from './layout-flow.ts'

function tool(id: string): AgentFlowSnapshot['nodes'][number] {
  return {
    id,
    kind: 'tool',
    label: id,
    inputText: '',
    outputText: '',
    status: 'done',
    turn: 1,
    step: 1,
    callId: id,
  }
}

describe('layoutAgentFlow Client / Host bands', () => {
  it('stacks sibling tools on the same X with distinct Y', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      latestTurn: 1,
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'model:1:1',
          kind: 'model',
          label: 'Model',
          inputText: '',
          outputText: '',
          status: 'done',
          turn: 1,
          step: 1,
        },
        tool('tool:a'),
        tool('tool:b'),
        {
          id: 'join:1:1',
          kind: 'join',
          label: 'Join',
          detail: '2 parallel tools',
          inputText: '',
          outputText: '',
          status: 'done',
          turn: 1,
          step: 1,
        },
      ],
      edges: [
        { from: 'model:1:1', to: 'tool:a', kind: 'data' },
        { from: 'model:1:1', to: 'tool:b', kind: 'data' },
        { from: 'tool:a', to: 'join:1:1', kind: 'flow' },
        { from: 'tool:b', to: 'join:1:1', kind: 'flow' },
      ],
    }
    const layout = layoutAgentFlow(snapshot)
    const a = layout.nodes.find(n => n.id === 'tool:a')!
    const b = layout.nodes.find(n => n.id === 'tool:b')!
    const join = layout.nodes.find(n => n.id === 'join:1:1')!
    const model = layout.nodes.find(n => n.id === 'model:1:1')!
    expect(a.x).toBe(b.x)
    expect(a.y).not.toBe(b.y)
    expect(join.x).toBeGreaterThan(a.x)
    expect(model.x).toBeLessThan(a.x)
    expect(layout.groups[0]?.parallelTools).toBe(true)
    expect(layout.groups[0]?.label).toContain('Host · Step 1')
  })

  it('buildColumns groups consecutive tools into one column', () => {
    const cols = buildColumns([
      { id: 'm', kind: 'model', label: 'M', inputText: '', outputText: '', status: 'done', turn: 1, step: 1 },
      tool('t1'),
      tool('t2'),
      { id: 'j', kind: 'join', label: 'J', inputText: '', outputText: '', status: 'done', turn: 1, step: 1 },
    ])
    expect(cols).toHaveLength(3)
    expect(cols[1]?.map(n => n.id)).toEqual(['t1', 't2'])
  })

  it('orders Client above Host · Frame above Host · Step with wire nodes in Client', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      latestTurn: 1,
      clientSurface: 'web',
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'input:1', kind: 'client-input', label: 'Web input', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'prompt:1', kind: 'remote-prompt', label: 'session.prompt', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'follow:1', kind: 'remote-follow', label: 'session.follow', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'admit:1', kind: 'host-admit', label: 'Host admit', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'context:1:1', kind: 'context', label: 'Context', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
        {
          id: 'model:1:1', kind: 'model', label: 'Model', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
        {
          id: 'render:1', kind: 'client-render', label: 'Client render', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
      ],
      edges: [
        { from: 'input:1', to: 'prompt:1', kind: 'data' },
        { from: 'prompt:1', to: 'admit:1', kind: 'data', label: 'session.prompt' },
        { from: 'admit:1', to: 'context:1:1', kind: 'flow' },
        { from: 'context:1:1', to: 'model:1:1', kind: 'data' },
        { from: 'follow:1', to: 'render:1', kind: 'data', label: 'session.follow' },
      ],
    }
    const layout = layoutAgentFlow(snapshot)
    expect(layout.groups.map(g => g.key)).toEqual([
      'client',
      'host-frame',
      'step:1',
    ])
    expect(layout.groups[0]?.label).toBe('Client · Web')
    const input = layout.nodes.find(n => n.id === 'input:1')!
    const prompt = layout.nodes.find(n => n.id === 'prompt:1')!
    const follow = layout.nodes.find(n => n.id === 'follow:1')!
    const admit = layout.nodes.find(n => n.id === 'admit:1')!
    const model = layout.nodes.find(n => n.id === 'model:1:1')!
    const render = layout.nodes.find(n => n.id === 'render:1')!
    expect(input.y).toBe(prompt.y)
    expect(prompt.y).toBe(follow.y)
    expect(follow.y).toBe(render.y)
    expect(input.x).toBeLessThan(prompt.x)
    expect(prompt.x).toBeLessThan(follow.x)
    expect(follow.x).toBeLessThan(render.x)
    expect(input.y).toBeLessThan(admit.y)
    expect(admit.y).toBeLessThan(model.y)
  })

  it('labels Host · Frame with Turn and agent preset', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      latestTurn: 1,
      agentPreset: 'standard',
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'envelope:1', kind: 'envelope', label: 'Envelope', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'admit:1', kind: 'host-admit', label: 'Host admit', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
      ],
      edges: [],
    }
    const layout = layoutAgentFlow(snapshot)
    expect(layout.groups.find(g => g.key === 'host-frame')?.label).toBe('Host · Frame · Turn 1 · standard')
  })

  it('labels Client · Web when clientSurface is web', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      latestTurn: 1,
      clientSurface: 'web',
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'input:1', kind: 'client-input', label: 'Web input', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'render:1', kind: 'client-render', label: 'Client render', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
      ],
      edges: [],
    }
    expect(layoutAgentFlow(snapshot).groups.find(g => g.key === 'client')?.label)
      .toBe('Client · Web')
  })

  it('aligns Envelope and Context centers on one vertical spine', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      latestTurn: 1,
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'profile:1', kind: 'profile', label: 'Profile', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'session:1', kind: 'session', label: 'Session', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'envelope:1', kind: 'envelope', label: 'Envelope', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'admit:1', kind: 'host-admit', label: 'Host admit', inputText: '', outputText: '',
          status: 'done', turn: 1,
        },
        {
          id: 'memory:1:1', kind: 'memory', label: 'Memory', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
        {
          id: 'context:1:1', kind: 'context', label: 'Context', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
        {
          id: 'model:1:1', kind: 'model', label: 'Model', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
      ],
      edges: [
        { from: 'envelope:1', to: 'context:1:1', kind: 'data' },
        { from: 'memory:1:1', to: 'context:1:1', kind: 'data' },
        { from: 'context:1:1', to: 'model:1:1', kind: 'data' },
      ],
    }
    const layout = layoutAgentFlow(snapshot)
    const envelope = layout.nodes.find(n => n.id === 'envelope:1')!
    const context = layout.nodes.find(n => n.id === 'context:1:1')!
    const memory = layout.nodes.find(n => n.id === 'memory:1:1')!
    const model = layout.nodes.find(n => n.id === 'model:1:1')!
    const envelopeCenterX = envelope.x + envelope.width / 2
    const contextCenterX = context.x + context.width / 2
    expect(envelopeCenterX).toBe(contextCenterX)
    expect(memory.x + memory.width / 2).toBeLessThan(contextCenterX)
    expect(model.x + model.width / 2).toBeGreaterThan(contextCenterX)
  })

  it('places Join above the next Host · Step band', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      latestTurn: 1,
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'model:1:1', kind: 'model', label: 'Model', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
        tool('tool:a'),
        tool('tool:b'),
        {
          id: 'join:1:1', kind: 'join', label: 'Join', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
        {
          id: 'context:1:2', kind: 'context', label: 'Context', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 2,
        },
      ],
      edges: [
        { from: 'model:1:1', to: 'tool:a', kind: 'data' },
        { from: 'model:1:1', to: 'tool:b', kind: 'data' },
        { from: 'tool:a', to: 'join:1:1', kind: 'flow' },
        { from: 'tool:b', to: 'join:1:1', kind: 'flow' },
        { from: 'join:1:1', to: 'context:1:2', kind: 'flow' },
      ],
    }
    const layout = layoutAgentFlow(snapshot)
    const join = layout.nodes.find(n => n.id === 'join:1:1')!
    const context2 = layout.nodes.find(n => n.id === 'context:1:2')!
    expect(join.y + join.height).toBeLessThanOrEqual(context2.y)
    expect(layout.edges.filter(e => e.to === 'context:1:2')).toEqual([
      { from: 'join:1:1', to: 'context:1:2', kind: 'flow' },
    ])
  })
})
