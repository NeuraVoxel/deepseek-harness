import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentObserveSnapshot } from '../types.ts'
import { layoutTopology, sortGroupKeys } from './layout.ts'

const sid = (value: string): SessionId => value as SessionId

const labels = { ungrouped: 'Ungrouped', workspaceTitle: (id: string) => id }

describe('sortGroupKeys', () => {
  it('orders workspace groups by Harness Workspaces list, ungrouped last', () => {
    expect(sortGroupKeys(
      ['ws-z', '__ungrouped__', 'ws-a', 'ws-m'],
      'workspace',
      ['ws-m', 'ws-z', 'ws-a'],
    )).toEqual(['ws-m', 'ws-z', 'ws-a', '__ungrouped__'])
  })

  it('falls back to localeCompare when workspace order is absent', () => {
    expect(sortGroupKeys(['ws-z', 'ws-a'], 'workspace')).toEqual(['ws-a', 'ws-z'])
  })
})

describe('layoutTopology workspace order', () => {
  it('lays out workspace columns left-to-right in sidebar list order', () => {
    const snapshot: AgentObserveSnapshot = {
      updatedAt: '2026-09-11T00:00:00.000Z',
      nodes: [
        { id: sid('in-z'), title: 'Z', status: 'idle', blank: false, workspaceId: 'ws-z' },
        { id: sid('in-a'), title: 'A', status: 'idle', blank: false, workspaceId: 'ws-a' },
        { id: sid('orphan'), title: 'Orphan', status: 'cold', blank: false },
      ],
      edges: [],
    }
    const layout = layoutTopology(snapshot, 'workspace', labels, {
      workspaceOrder: ['ws-z', 'ws-a'],
    })
    expect(layout.groups.map(group => group.key)).toEqual(['ws-z', 'ws-a', '__ungrouped__'])
    expect(layout.groups[0]!.x).toBeLessThan(layout.groups[1]!.x)
    expect(layout.groups[1]!.x).toBeLessThan(layout.groups[2]!.x)
  })
})
