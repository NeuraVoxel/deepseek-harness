import { describe, expect, it } from 'vitest'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('applyPatch', () => {
  const base = parseDocument({
    version: 1,
    nodes: [{ id: 'a', type: 'agent', label: 'A' }],
    edges: [],
  })

  it('adds and removes a node', () => {
    const withB = applyPatch(base, {
      ops: [{ op: 'addNode', node: { id: 'b', type: 'agent', label: 'B' } }],
    })
    expect(withB.nodes).toHaveLength(2)
    const removed = applyPatch(withB, { ops: [{ op: 'removeNode', id: 'b' }] })
    expect(removed.nodes).toHaveLength(1)
    expect(base.nodes).toHaveLength(1)
  })

  it('throws on missing update target without mutating input', () => {
    expect(() => applyPatch(base, {
      ops: [{ op: 'updateNode', id: 'missing', patch: { label: 'X' } }],
    })).toThrow(/missing id/)
    expect(base.nodes[0]?.label).toBe('A')
  })

  it('sets alarms on a node', () => {
    const next = applyPatch(base, {
      ops: [{
        op: 'setAlarms',
        elementId: 'a',
        target: 'node',
        alarms: [{ id: 'e1', level: 'error', message: 'failed' }],
      }],
    })
    expect(next.nodes[0]?.alarms?.[0]?.level).toBe('error')
  })
})
