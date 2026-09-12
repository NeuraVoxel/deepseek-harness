import { describe, expect, it } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { clientNodeStatus, deriveClientTopology, turnCountFromSummary } from './derive-topology.ts'

const sid = (value: string): SessionId => value as SessionId

function listState(rows: Array<{
  id: string
  running?: boolean
  blank?: boolean
  parentId?: string
  cwd?: string
  turns?: number
}>): SessionListState {
  const ids = rows.map(row => sid(row.id))
  const byId = Object.fromEntries(rows.map(row => [sid(row.id), {
    id: sid(row.id),
    displayTitle: row.id,
    running: row.running ?? false,
    blank: row.blank ?? false,
    updatedAt: 1,
    ...(row.parentId === undefined ? {} : { parentId: sid(row.parentId) }),
    ...(row.cwd === undefined ? {} : { cwd: row.cwd }),
    ...(row.turns === undefined
      ? {}
      : { projectionValues: { sessionStats: { turns: row.turns } } }),
  }])) as SessionListState['byId']
  return {
    ids,
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function workspaces(
  archivedSessionIds: readonly string[] = [],
  items: WorkspaceSnapshot['items'] = [],
): WorkspaceSnapshot {
  return {
    items,
    archivedSessionIds: archivedSessionIds.map(sid),
    state: 'idle',
    phase: 'ready',
    error: null,
  }
}

describe('clientNodeStatus', () => {
  it('prefers running over archive membership', () => {
    expect(clientNodeStatus({ running: true }, true)).toBe('running')
  })

  it('marks archived non-running rows as archived, not idle', () => {
    expect(clientNodeStatus({ running: false }, true)).toBe('archived')
  })

  it('keeps live non-running non-archived rows as idle', () => {
    expect(clientNodeStatus({ running: false }, false)).toBe('idle')
  })
})

describe('deriveClientTopology', () => {
  it('projects running, idle, and archived statuses from Client lists', () => {
    const snapshot = deriveClientTopology(
      listState([
        { id: 'live-run', running: true },
        { id: 'live-idle' },
        { id: 'done-archived' },
        { id: 'still-running-archived', running: true },
      ]),
      workspaces(['done-archived', 'still-running-archived']),
    )
    const byId = Object.fromEntries(snapshot.nodes.map(node => [String(node.id), node.status]))
    expect(byId).toEqual({
      'live-run': 'running',
      'live-idle': 'idle',
      'done-archived': 'archived',
      'still-running-archived': 'running',
    })
  })

  it('keeps parent edges for archived children', () => {
    const snapshot = deriveClientTopology(
      listState([
        { id: 'parent' },
        { id: 'child', parentId: 'parent' },
      ]),
      workspaces(['child']),
    )
    expect(snapshot.nodes.find(n => n.id === sid('child'))?.status).toBe('archived')
    expect(snapshot.edges).toEqual([{ from: sid('parent'), to: sid('child'), kind: 'parent' }])
  })

  it('projects turnCount from sessionStats and blank rows', () => {
    const snapshot = deriveClientTopology(
      listState([
        { id: 'with-turns', turns: 4 },
        { id: 'blank', blank: true },
        { id: 'unknown' },
      ]),
      workspaces(),
    )
    const byId = Object.fromEntries(snapshot.nodes.map(node => [String(node.id), node.turnCount]))
    expect(byId).toEqual({
      'with-turns': 4,
      blank: 0,
      unknown: undefined,
    })
  })
})

describe('turnCountFromSummary', () => {
  it('returns 0 for blank rows even without sessionStats', () => {
    expect(turnCountFromSummary({
      id: sid('b'),
      displayTitle: 'b',
      running: false,
      blank: true,
      updatedAt: 1,
    })).toBe(0)
  })
})
