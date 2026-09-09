import { describe, expect, it } from 'vitest'
import { invertOp, invertPatch } from '../src/protocol/invert.ts'
import { PatchHistory } from '../src/protocol/patch-history.ts'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('invertOp', () => {
  const base = parseDocument({
    version: 1,
    nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
    edges: [{ id: 'e1', from: 'a', to: 'a' }],
    viewport: { x: 0, y: 0, zoom: 1 },
  })

  it('inverts updateNode to prior x/y', () => {
    const inv = invertOp(base, { op: 'updateNode', id: 'a', patch: { x: 10, y: 20 } })
    expect(inv).toEqual({ op: 'updateNode', id: 'a', patch: { x: 1, y: 2 } })
  })

  it('skips SubNetwork navigation and setSelection', () => {
    expect(invertOp(base, { op: 'enterSubNetwork', id: 'n1' })).toEqual([])
    expect(invertOp(base, { op: 'exitSubNetwork' })).toEqual([])
    expect(invertOp(base, { op: 'setSelection', selectedIds: ['a'] })).toEqual([])
  })

  it('removeNode inverse restores node and cascaded edges', () => {
    const inv = invertOp(base, { op: 'removeNode', id: 'a' })
    expect(inv).toEqual([
      { op: 'addNode', node: { id: 'a', type: 'agent', label: 'A', x: 1, y: 2 } },
      { op: 'addEdge', edge: { id: 'e1', from: 'a', to: 'a' } },
    ])
  })

  it('invertPatch reverses multi-op order', () => {
    const ops = invertPatch(base, {
      ops: [
        { op: 'updateNode', id: 'a', patch: { x: 9 } },
        { op: 'setViewport', viewport: { x: 5, y: 5, zoom: 2 } },
      ],
    })
    expect(ops).toEqual([
      { op: 'setViewport', viewport: { x: 0, y: 0, zoom: 1 } },
      { op: 'updateNode', id: 'a', patch: { x: 1 } },
    ])
  })
})

describe('PatchHistory', () => {
  it('updateNode undo restores x/y; redo reapplies', () => {
    let doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
      edges: [],
    })
    const history = new PatchHistory(
      (patch) => { doc = applyPatch(doc, patch) },
      () => doc,
    )

    history.pushAndApply({ ops: [{ op: 'updateNode', id: 'a', patch: { x: 10, y: 20 } }] })
    expect(doc.nodes[0]?.x).toBe(10)
    expect(doc.nodes[0]?.y).toBe(20)

    expect(history.undo()).toBe(true)
    expect(doc.nodes[0]?.x).toBe(1)
    expect(doc.nodes[0]?.y).toBe(2)

    expect(history.redo()).toBe(true)
    expect(doc.nodes[0]?.x).toBe(10)
    expect(doc.nodes[0]?.y).toBe(20)
  })

  it('failed apply does not push', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
      edges: [],
    })
    const history = new PatchHistory(
      () => { throw new Error('apply failed') },
      () => doc,
    )

    expect(() => history.pushAndApply({
      ops: [{ op: 'updateNode', id: 'a', patch: { x: 3 } }],
    })).toThrow(/apply failed/)

    expect(history.undo()).toBe(false)
    expect(doc.nodes[0]?.x).toBe(1)
  })
})
