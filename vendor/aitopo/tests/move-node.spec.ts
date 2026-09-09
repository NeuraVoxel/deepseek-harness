import { describe, expect, it, vi } from 'vitest'
import { MoveNodeInteraction } from '../src/interaction/move-node.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphNode } from '../src/protocol/types.ts'

/** Minimal EventTarget-like canvas for node-env MoveNode tests. */
class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>()
  pointerCaptureIds = new Set<number>()

  addEventListener(type: string, listener: (event: PointerEvent) => void): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: PointerEvent) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    }
  }

  setPointerCapture(pointerId: number): void {
    this.pointerCaptureIds.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.pointerCaptureIds.delete(pointerId)
  }

  dispatch(
    type: string,
    partial: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'> & {
      pointerId?: number
      altKey?: boolean
    },
  ): void {
    const event = {
      pointerId: 1,
      altKey: false,
      ...partial,
    } as PointerEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function node(partial: Partial<GraphNode> & Pick<GraphNode, 'id'>): GraphNode {
  return {
    type: 'u',
    label: partial.id,
    x: 0,
    y: 0,
    ...partial,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  nodes: GraphNode[]
  selectedIds?: string[]
  hitId?: string
  groupOnUp?: string | undefined
  zoom?: number
}): InteractionHost & {
  commitNodeMove: ReturnType<typeof vi.fn>
  previewNodePosition: ReturnType<typeof vi.fn>
  markGestureDragged: ReturnType<typeof vi.fn>
  setSelection: ReturnType<typeof vi.fn>
  setDragPaintFilter: ReturnType<typeof vi.fn>
} {
  const nodes = new Map(options.nodes.map(n => [n.id, n]))
  let selectedIds = [...(options.selectedIds ?? [])]
  let gestureDragged = false
  const hitId = options.hitId ?? options.nodes[0]?.id
  const zoom = options.zoom ?? 1
  let groupOnUp = options.groupOnUp

  const commitNodeMove = vi.fn()
  const previewNodePosition = vi.fn()
  const markGestureDragged = vi.fn(() => {
    gestureDragged = true
  })
  const setSelection = vi.fn((ids: readonly string[]) => {
    selectedIds = [...ids]
  })
  const setDragPaintFilter = vi.fn()

  return {
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: () =>
      hitId === undefined ? undefined : { id: hitId, kind: 'node' as const },
    setSelection,
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.get(id),
    getNodes: () => [...nodes.values()],
    getEdges: () => [],
    getGroups: () => [],
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => groupOnUp,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition,
    commitNodeMove,
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    markGestureDragged,
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    setMarqueeRect: vi.fn(),
    setEdgeRubberBand: vi.fn(),
    setDragPaintFilter,
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

function dragPastThreshold(
  canvas: FakeHitCanvas,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.dispatch('pointerdown', { button: 0, clientX: from.x, clientY: from.y })
  canvas.dispatch('pointermove', { button: 0, clientX: to.x, clientY: to.y })
  canvas.dispatch('pointerup', { button: 0, clientX: to.x, clientY: to.y })
}

describe('MoveNodeInteraction', () => {
  it('skips locked nodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', locked: true, x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })

    expect(host.commitNodeMove).not.toHaveBeenCalled()
    expect(host.markGestureDragged).not.toHaveBeenCalled()
    dispose()
  })

  it('commits unlocked move with nodeId and from', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })

    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        from: { x: 10, y: 20 },
        to: { x: 30, y: 20 },
      }),
    )
    dispose()
  })

  it('passes toGroupId from hitTestGroupScreen on up', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20, groupId: 'g1' })],
      selectedIds: ['a'],
      hitId: 'a',
      groupOnUp: 'g2',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 40, y: 10 })

    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        toGroupId: 'g2',
      }),
    )
    dispose()
  })

  it('moves multi-select unlocked nodes with shared delta', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 }), node({ id: 'b', x: 50, y: 60 })],
      selectedIds: ['a', 'b'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 20 })

    expect(host.commitNodeMove).toHaveBeenCalledTimes(2)
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        from: { x: 10, y: 20 },
        to: { x: 30, y: 30 },
      }),
    )
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'b',
        from: { x: 50, y: 60 },
        to: { x: 70, y: 70 },
      }),
    )
    dispose()
  })

  it('calls markGestureDragged once threshold crossed', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 12, clientY: 10 })
    expect(host.markGestureDragged).not.toHaveBeenCalled()
    expect(host.previewNodePosition).not.toHaveBeenCalled()

    canvas.dispatch('pointermove', { button: 0, clientX: 14, clientY: 10 })
    expect(host.markGestureDragged).toHaveBeenCalledTimes(1)
    expect(host.previewNodePosition).toHaveBeenCalled()
    expect(canvas.pointerCaptureIds.has(1)).toBe(true)

    canvas.dispatch('pointerup', { button: 0, clientX: 14, clientY: 10 })
    dispose()
  })

  it('hit locked node already in selection with unlocked sibling commits only unlocked', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'locked', locked: true, x: 10, y: 20 }),
        node({ id: 'free', x: 50, y: 60 }),
      ],
      selectedIds: ['locked', 'free'],
      hitId: 'locked',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 20 })

    expect(host.commitNodeMove).toHaveBeenCalledTimes(1)
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'free',
        from: { x: 50, y: 60 },
        to: { x: 70, y: 70 },
      }),
    )
    expect(host.commitNodeMove).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'locked' }),
    )
    dispose()
  })

  it('multi-select with one locked commits only unlocked nodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'a', x: 10, y: 20 }),
        node({ id: 'b', locked: true, x: 40, y: 50 }),
        node({ id: 'c', x: 70, y: 80 }),
      ],
      selectedIds: ['a', 'b', 'c'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })

    expect(host.commitNodeMove).toHaveBeenCalledTimes(2)
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        from: { x: 10, y: 20 },
        to: { x: 30, y: 20 },
      }),
    )
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'c',
        from: { x: 70, y: 80 },
        to: { x: 90, y: 80 },
      }),
    )
    expect(host.commitNodeMove).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'b' }),
    )
    dispose()
  })

  it('dispose mid-drag reverts preview and releases pointer capture', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 30, clientY: 10 })
    expect(canvas.pointerCaptureIds.has(1)).toBe(true)
    expect(host.previewNodePosition).toHaveBeenCalledWith('a', 30, 20)

    dispose()

    expect(canvas.pointerCaptureIds.has(1)).toBe(false)
    expect(host.previewNodePosition).toHaveBeenLastCalledWith('a', 10, 20)
    expect(host.commitNodeMove).not.toHaveBeenCalled()
  })

  it('pointercancel mid-drag reverts preview without commit', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 30, clientY: 10 })
    canvas.dispatch('pointercancel', { button: 0, clientX: 30, clientY: 10 })

    expect(canvas.pointerCaptureIds.has(1)).toBe(false)
    expect(host.previewNodePosition).toHaveBeenLastCalledWith('a', 10, 20)
    expect(host.commitNodeMove).not.toHaveBeenCalled()
    dispose()
  })

  it('ignores Alt+pointerdown (CreateEdge owns that gesture)', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 40, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 10, altKey: true })
    expect(host.commitNodeMove).not.toHaveBeenCalled()
    expect(host.setDragPaintFilter).not.toHaveBeenCalled()
    dispose()
  })

  it('default does not set drag paint filter while dragging', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)
    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })
    expect(host.setDragPaintFilter).not.toHaveBeenCalled()
    dispose()
  })

  it('hideOthersWhileDragging sets and clears paint filter', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction({ hideOthersWhileDragging: true }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 30, clientY: 10 })
    expect(host.setDragPaintFilter).toHaveBeenCalledWith(['a'])
    canvas.dispatch('pointerup', { button: 0, clientX: 30, clientY: 10 })
    expect(host.setDragPaintFilter).toHaveBeenLastCalledWith(undefined)
    dispose()
  })
})
