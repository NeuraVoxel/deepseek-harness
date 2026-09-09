import { describe, expect, it, vi } from 'vitest'
import { CreateEdgeInteraction } from '../src/interaction/create-edge.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphNode } from '../src/protocol/types.ts'

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
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
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
    w: 40,
    h: 40,
    ...partial,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  nodes: GraphNode[]
  hitAt: (x: number, y: number) => { id: string; kind: 'node' | 'edge' } | undefined
}): InteractionHost & {
  commitEdgeCreate: ReturnType<typeof vi.fn>
  setEdgeRubberBand: ReturnType<typeof vi.fn>
} {
  const nodes = new Map(options.nodes.map(n => [n.id, n]))
  const commitEdgeCreate = vi.fn(() => 'e-new')
  const setEdgeRubberBand = vi.fn()
  let gestureDragged = false

  return {
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: (x, y) => options.hitAt(x, y),
    setSelection: vi.fn(),
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.get(id),
    getNodes: () => [...nodes.values()],
    getEdges: () => [],
    getGroups: () => [],
    getSelectedIds: () => [],
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    commitNodeMove: vi.fn(),
    commitEdgeCreate,
    commitEdgeRemove: vi.fn(),
    markGestureDragged: () => {
      gestureDragged = true
    },
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    setMarqueeRect: vi.fn(),
    setEdgeRubberBand,
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

describe('CreateEdgeInteraction', () => {
  it('requires Alt by default and creates edge on drop onto another node', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 100, y: 0 })],
      hitAt: (x) => (x < 50 ? { id: 'a', kind: 'node' } : { id: 'b', kind: 'node' }),
    })
    const dispose = new CreateEdgeInteraction({ kind: 'data' }).attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10 })
    expect(host.commitEdgeCreate).not.toHaveBeenCalled()

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.setEdgeRubberBand).toHaveBeenCalled()
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).toHaveBeenCalledWith({ from: 'a', to: 'b', kind: 'data' })
    expect(host.setEdgeRubberBand).toHaveBeenLastCalledWith(undefined)
    dispose()
  })

  it('exclusive mode (requireAlt false) creates without Alt', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 100, y: 0 })],
      hitAt: (x) => (x < 50 ? { id: 'a', kind: 'node' } : { id: 'b', kind: 'node' }),
    })
    const dispose = new CreateEdgeInteraction({ requireAlt: false, kind: 'control' }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10 })
    expect(host.commitEdgeCreate).toHaveBeenCalledWith({ from: 'a', to: 'b', kind: 'control' })
    dispose()
  })

  it('does not create when released on empty space', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 })],
      hitAt: (x) => (x < 50 ? { id: 'a', kind: 'node' } : undefined),
    })
    const dispose = new CreateEdgeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).not.toHaveBeenCalled()
    dispose()
  })
})
