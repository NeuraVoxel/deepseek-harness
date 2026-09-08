import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { alarmsFromStatus } from './alarms-from-status.ts'
import { snapshotToDocument } from './snapshot-to-document.ts'
import { flowToDocument } from './flow-to-document.ts'
import type { AgentCanvasSnapshot } from '../../types.ts'
import type { AgentFlowSnapshot } from '../derive-flow.ts'

const sid = (value: string): SessionId => value as SessionId

describe('aitopo adapters', () => {
  it('maps fleet snapshot ids to plain strings with layout positions', () => {
    const snapshot: AgentCanvasSnapshot = {
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: sid('a'),
          title: 'Agent A',
          status: 'running',
          blank: false,
          workspaceId: 'ws-1',
        },
        {
          id: sid('b'),
          title: 'Agent B',
          status: 'idle',
          blank: false,
          parentId: sid('a'),
          workspaceId: 'ws-1',
          origin: 'subagent',
        },
      ],
      edges: [{ from: sid('a'), to: sid('b'), kind: 'parent' }],
    }
    const { document, layout } = snapshotToDocument({
      snapshot,
      groupMode: 'workspace',
      labels: { ungrouped: 'Ungrouped', workspaceTitle: id => id },
      currentSessionId: sid('a'),
    })
    expect(document.version).toBe(1)
    expect(document.nodes).toHaveLength(2)
    expect(document.nodes[0]?.id).toBe('a')
    expect(typeof document.nodes[0]?.x).toBe('number')
    expect(document.edges[0]?.from).toBe('a')
    expect(layout.nodes).toHaveLength(2)
  })

  it('builds team SubNetworks when teamId is present', () => {
    const snapshot: AgentCanvasSnapshot = {
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: sid('t1'),
          title: 'T1',
          status: 'idle',
          blank: false,
          teamId: 'alpha',
        },
      ],
      edges: [],
    }
    const { document, hasTeamNetworks } = snapshotToDocument({
      snapshot,
      groupMode: 'teams',
      labels: { ungrouped: 'Ungrouped', workspaceTitle: id => id },
    })
    expect(hasTeamNetworks).toBe(true)
    expect(document.networks?.['team:alpha']).toBeDefined()
    expect(document.nodes[0]?.networkId).toBe('team:alpha')
  })

  it('maps flow errors to alarms and tool circles to top-left bounds', () => {
    const snapshot: AgentFlowSnapshot = {
      turn: 1,
      running: false,
      updatedAt: '2026-09-07T00:00:00.000Z',
      nodes: [
        {
          id: 'step:1',
          kind: 'step',
          label: 'Step',
          inputText: 'in',
          outputText: 'out',
          status: 'error',
          turn: 1,
          step: 1,
          detail: 'boom',
        },
        {
          id: 'tool:1',
          kind: 'tool',
          label: 'Bash',
          inputText: '',
          outputText: '',
          status: 'done',
          turn: 1,
          step: 1,
        },
      ],
      edges: [{ from: 'step:1', to: 'tool:1', kind: 'flow' }],
    }
    const { document } = flowToDocument(snapshot)
    const step = document.nodes.find(n => n.id === 'step:1')
    const tool = document.nodes.find(n => n.id === 'tool:1')
    expect(step?.alarms?.[0]?.level).toBe('error')
    expect(tool?.type).toBe('tool')
    expect(tool?.w).toBe(56)
    expect(tool?.h).toBe(56)
  })

  it('alarmsFromStatus only emits on error', () => {
    expect(alarmsFromStatus('active', 'n1')).toBeUndefined()
    expect(alarmsFromStatus('error', 'n1', 'fail')?.[0]?.message).toBe('fail')
  })
})
