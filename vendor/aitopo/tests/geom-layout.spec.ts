import { describe, expect, it } from 'vitest'
import { hitRect, unionRect } from '../src/geom.ts'
import { DirtyAccumulator } from '../src/network/dirty.ts'
import { layoutGrid, layoutFlowColumns } from '../src/layout/index.ts'
import { Viewport } from '../src/network/viewport.ts'
import { edgeAnchors } from '../src/ui/bounds.ts'

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

  it('routes Join → next Step from bottom to top when bands stack', () => {
    const join = { id: 'join', type: 'join', label: 'Join', x: 400, y: 40, w: 148, h: 56 }
    const step = { id: 'step', type: 'step', label: 'Step 2', x: 28, y: 200, w: 148, h: 56 }
    const anchors = edgeAnchors(join, step)
    expect(anchors.orientation).toBe('vertical')
    expect(anchors.from.y).toBe(40 + 56)
    expect(anchors.to.y).toBe(200)
  })

  it('fans Model → Tools from the shared right mid with orthogonal points', () => {
    const model = { id: 'm', type: 'model', label: 'Model', x: 40, y: 100, w: 148, h: 56 }
    const toolA = { id: 'ta', type: 'tool', label: 'A', x: 260, y: 40, w: 56, h: 56 }
    const toolB = { id: 'tb', type: 'tool', label: 'B', x: 260, y: 160, w: 56, h: 56 }
    const a = edgeAnchors(model, toolA)
    const b = edgeAnchors(model, toolB)
    expect(a.orientation).toBe('horizontal')
    expect(a.from).toEqual(b.from)
    expect(a.from).toEqual({ x: 40 + 148, y: 100 + 28 })
    expect(a.to.x).toBe(260)
    expect(a.points[0]).toEqual(a.from)
    expect(a.points[a.points.length - 1]).toEqual(a.to)
    expect(a.points.length).toBeGreaterThanOrEqual(2)
  })
})
