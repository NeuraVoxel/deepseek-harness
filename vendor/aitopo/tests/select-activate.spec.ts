import { describe, expect, it, vi } from 'vitest'
import { SelectActivateInteraction } from '../src/interaction/select-activate.ts'
import type { InteractionHost } from '../src/interaction/types.ts'

/** Minimal EventTarget-like canvas for node-env SelectActivate tests. */
class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>()

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

  dispatch(type: string, partial: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>): void {
    const event = partial as PointerEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function createHost(canvas: FakeHitCanvas): InteractionHost & {
  gestureDragged: boolean
  activateNode: ReturnType<typeof vi.fn>
} {
  let gestureDragged = false
  const activateNode = vi.fn()
  const host = {
    get gestureDragged() {
      return gestureDragged
    },
    set gestureDragged(value: boolean) {
      gestureDragged = value
    },
    activateNode,
    getHitElement: () => canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: () => ({ id: 'n1', kind: 'node' as const }),
    setSelection: vi.fn(),
    setHover: vi.fn(),
    updateCamera: vi.fn(),
    viewport: {} as InteractionHost['viewport'],
    getNode: () => undefined,
    getNodes: () => [],
    getEdges: () => [],
    getGroups: () => [],
    getSelectedIds: () => [],
    hitTestGroupScreen: () => undefined,
    screenToWorld: () => ({ x: 0, y: 0 }),
    previewNodePosition: vi.fn(),
    commitNodeMove: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    markGestureDragged: () => {
      gestureDragged = true
    },
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    setMarqueeRect: vi.fn(),
    setEdgeRubberBand: vi.fn(),
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
  }
  return host
}

describe('SelectActivate drag gate', () => {
  it('activates on pointerup when no drag gesture ran', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas)
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    expect(host.gestureDragged).toBe(false)
    canvas.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10 })

    expect(host.activateNode).toHaveBeenCalledWith('n1', 'click')
    dispose()
  })

  it('skips activate on pointerup after markGestureDragged', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas)
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    host.markGestureDragged()
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 40 })

    expect(host.activateNode).not.toHaveBeenCalled()
    dispose()
  })
})
