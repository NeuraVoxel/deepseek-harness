import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('editor protocol', () => {
  it('accepts locked node and dashed group style', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', locked: true, x: 0, y: 0 }],
      edges: [],
      groups: [{
        id: 'g',
        label: 'Composition',
        memberIds: ['a'],
        style: { stroke: '#22c55e', strokeWidth: 2, strokeDash: [8, 4] },
      }],
    })
    expect(doc.nodes[0]?.locked).toBe(true)
    expect(doc.groups?.[0]?.style?.strokeDash).toEqual([8, 4])
  })

  it('preserves group style through scene toJSON round-trip', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', x: 0, y: 0 }],
      edges: [],
      groups: [{
        id: 'g',
        label: 'Composition',
        memberIds: ['a'],
        style: {
          stroke: '#22c55e',
          strokeWidth: 2,
          strokeDash: [8, 4],
          fill: 'rgba(34, 197, 94, 0.1)',
        },
      }],
    })
    const scene = new GraphScene()
    scene.load(doc)
    expect(scene.toJSON().groups?.[0]?.style).toEqual({
      stroke: '#22c55e',
      strokeWidth: 2,
      strokeDash: [8, 4],
      fill: 'rgba(34, 197, 94, 0.1)',
    })
  })

  it('rejects invalid group style type', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      groups: [{
        id: 'g',
        label: 'Bad',
        memberIds: [],
        style: 'dashed',
      }],
    })).toThrow(/parse failed/)
  })
})
