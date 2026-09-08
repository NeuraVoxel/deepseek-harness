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

describe('layoutAgentFlow parallel columns', () => {
  it('stacks sibling tools on the same X with distinct Y', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'step:1:1',
          kind: 'step',
          label: 'Step 1',
          inputText: '',
          outputText: '',
          status: 'done',
          turn: 1,
          step: 1,
        },
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
        { from: 'step:1:1', to: 'model:1:1', kind: 'flow' },
        { from: 'model:1:1', to: 'tool:a', kind: 'flow' },
        { from: 'model:1:1', to: 'tool:b', kind: 'flow' },
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

  it('places Join above the next Step band with a single Join → Step edge', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'step:1:1', kind: 'step', label: 'Step 1', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 1,
        },
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
          id: 'step:1:2', kind: 'step', label: 'Step 2', inputText: '', outputText: '',
          status: 'done', turn: 1, step: 2,
        },
      ],
      edges: [
        { from: 'step:1:1', to: 'model:1:1', kind: 'flow' },
        { from: 'model:1:1', to: 'tool:a', kind: 'flow' },
        { from: 'model:1:1', to: 'tool:b', kind: 'flow' },
        { from: 'tool:a', to: 'join:1:1', kind: 'flow' },
        { from: 'tool:b', to: 'join:1:1', kind: 'flow' },
        { from: 'join:1:1', to: 'step:1:2', kind: 'flow' },
      ],
    }
    const layout = layoutAgentFlow(snapshot)
    const join = layout.nodes.find(n => n.id === 'join:1:1')!
    const step2 = layout.nodes.find(n => n.id === 'step:1:2')!
    expect(join.y + join.height).toBeLessThanOrEqual(step2.y)
    expect(layout.edges.filter(e => e.to === 'step:1:2')).toEqual([
      { from: 'join:1:1', to: 'step:1:2', kind: 'flow' },
    ])
  })
})
