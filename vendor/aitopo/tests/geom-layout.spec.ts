import { describe, expect, it } from 'vitest'
import { hitRect, unionRect } from '../src/geom.ts'
import { DirtyAccumulator } from '../src/network/dirty.ts'
import { layoutGrid, layoutFlowColumns } from '../src/layout/index.ts'
import { Viewport } from '../src/network/viewport.ts'

describe('geom + dirty + viewport + layout', () => {
  it('unions rects and hits points', () => {
    const u = unionRect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
    )
    expect(u).toEqual({ x: 0, y: 0, width: 15, height: 15 })
    expect(hitRect({ x: 1, y: 1 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true)
    expect(hitRect({ x: 20, y: 20 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(false)
  })

  it('accumulates dirty rects and invalidateAll', () => {
    const dirty = new DirtyAccumulator()
    dirty.add({ x: 0, y: 0, width: 10, height: 10 })
    dirty.add({ x: 20, y: 0, width: 10, height: 10 })
    expect(dirty.rect?.width).toBe(30)
    dirty.markAll()
    expect(dirty.isAll).toBe(true)
    const taken = dirty.take()
    expect(taken.invalidateAll).toBe(true)
    expect(dirty.dirty).toBe(false)
  })

  it('fits viewport bounds', () => {
    const viewport = new Viewport()
    viewport.setViewSize({ width: 200, height: 100 })
    viewport.fitBounds({ x: 0, y: 0, width: 100, height: 50 }, 0)
    expect(viewport.state.zoom).toBe(2)
  })

  it('layouts grid and flow', () => {
    const grid = layoutGrid({
      version: 1,
      nodes: [
        { id: 'a', type: 'agent', label: 'A', groupId: 'g' },
        { id: 'b', type: 'agent', label: 'B', groupId: 'g' },
      ],
      edges: [],
      groups: [{ id: 'g', label: 'G', memberIds: ['a', 'b'] }],
    })
    expect(grid.a).toBeDefined()
    expect(grid.b).toBeDefined()

    const flow = layoutFlowColumns({
      version: 1,
      nodes: [
        { id: 's1', type: 'step', label: '1', data: { column: 0 } },
        { id: 's2', type: 'step', label: '2', data: { column: 1 } },
      ],
      edges: [],
    })
    expect(flow.s1!.x).toBeLessThan(flow.s2!.x)
  })
})
