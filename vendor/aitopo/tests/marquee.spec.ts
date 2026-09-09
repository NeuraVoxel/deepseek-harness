import { describe, expect, it, vi } from 'vitest'
import { MarqueeSelectInteraction } from '../src/interaction/marquee-select.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphNode } from '../src/protocol/types.ts'
import type { Rect } from '../src/geom.ts'

/** Minimal EventTarget-like canvas for node-env MarqueeSelect tests. */
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
      shiftKey?: boolean
    },
  ): void {
    const event = {
      pointerId: 1,
      shiftKey: false,
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
  hitId?: string
}): InteractionHost & {
  setSelection: ReturnType<typeof vi.fn>
  setMarqueeRect: ReturnType<typeof vi.fn>
  markGestureDragged: ReturnType<typeof vi.fn>
  marqueeRects: Array<Rect | undefined>
} {
  const nodes = [...options.nodes]
  const hitId = options.hitId
  let gestureDragged = false
  const marqueeRects: Array<Rect | undefined> = []

  const setSelection = vi.fn()
  const setMarqueeRect = vi.fn((rect: Rect | undefined) => {
    marqueeRects.push(rect)
  })
  const markGestureDragged = vi.fn(() => {
    gestureDragged = true
  })

  return {
    marqueeRects,
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: () =>
      hitId === undefined ? undefined : { id: hitId, kind: 'node' as const },
    setSelection,
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.find(n => n.id === id),
    getNodes: () => nodes,
    getGroups: () => [],
    getSelectedIds: () => [],
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    commitNodeMove: vi.fn(),
    markGestureDragged,
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    setMarqueeRect,
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

function shiftMarquee(
  canvas: FakeHitCanvas,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.dispatch('pointerdown', { button: 0, clientX: from.x, clientY: from.y, shiftKey: true })
  canvas.dispatch('pointermove', { button: 0, clientX: to.x, clientY: to.y, shiftKey: true })
  canvas.dispatch('pointerup', { button: 0, clientX: to.x, clientY: to.y, shiftKey: true })
}

describe('MarqueeSelectInteraction', () => {
  it('Shift+empty drag selects intersecting nodes (replace)', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'in', x: 20, y: 20 }),
        node({ id: 'out', x: 200, y: 200 }),
      ],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    shiftMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 })

    expect(host.setSelection).toHaveBeenCalledWith(['in'])
    expect(host.marqueeRects.at(-1)).toBeUndefined()
    dispose()
  })

  it('selects locked nodes whose bounds intersect', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'locked', locked: true, x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    shiftMarquee(canvas, { x: 0, y: 0 }, { x: 60, y: 60 })

    expect(host.setSelection).toHaveBeenCalledWith(['locked'])
    dispose()
  })

  it('without Shift does nothing', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0, shiftKey: false })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 80 })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 80 })

    expect(host.setSelection).not.toHaveBeenCalled()
    expect(host.setMarqueeRect).not.toHaveBeenCalled()
    expect(host.markGestureDragged).not.toHaveBeenCalled()
    dispose()
  })

  it('ignores Shift+drag when hitTestScreen finds a node', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
      hitId: 'a',
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    shiftMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 })

    expect(host.setSelection).not.toHaveBeenCalled()
    expect(host.setMarqueeRect).not.toHaveBeenCalled()
    dispose()
  })

  it('updates marquee rect during drag past threshold', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0, shiftKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 2, clientY: 0, shiftKey: true })
    expect(host.setMarqueeRect).not.toHaveBeenCalled()
    expect(host.markGestureDragged).not.toHaveBeenCalled()

    canvas.dispatch('pointermove', { button: 0, clientX: 50, clientY: 40, shiftKey: true })
    expect(host.markGestureDragged).toHaveBeenCalledTimes(1)
    expect(host.setMarqueeRect).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 50,
      height: 40,
    })
    expect(canvas.pointerCaptureIds.has(1)).toBe(true)

    canvas.dispatch('pointerup', { button: 0, clientX: 50, clientY: 40, shiftKey: true })
    expect(host.marqueeRects.at(-1)).toBeUndefined()
    dispose()
  })
})
