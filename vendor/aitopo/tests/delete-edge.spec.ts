import { describe, expect, it, vi } from 'vitest'
import { DeleteEdgeInteraction } from '../src/interaction/delete-edge.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphEdge } from '../src/protocol/types.ts'

class FakeView {
  private readonly listeners = new Map<string, Set<(event: KeyboardEvent) => void>>()
  tabIndex = -1

  addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string, partial: Partial<KeyboardEvent> & { key: string }): void {
    const event = {
      preventDefault: vi.fn(),
      target: this,
      ...partial,
    } as unknown as KeyboardEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function createHost(options: {
  view: FakeView
  edges: GraphEdge[]
  selectedIds: string[]
}): InteractionHost & {
  commitEdgeRemove: ReturnType<typeof vi.fn>
  setSelection: ReturnType<typeof vi.fn>
} {
  let selectedIds = [...options.selectedIds]
  const commitEdgeRemove = vi.fn()
  const setSelection = vi.fn((ids: readonly string[]) => {
    selectedIds = [...ids]
  })

  return {
    getViewElement: () => options.view as unknown as HTMLDivElement,
    getHitElement: () => null,
    hitTestScreen: () => undefined,
    setSelection,
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: () => undefined,
    getNodes: () => [],
    getEdges: () => options.edges,
    getGroups: () => [],
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    commitNodeMove: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove,
    markGestureDragged: vi.fn(),
    wasGestureDragged: () => false,
    clearGestureDragged: vi.fn(),
    setMarqueeRect: vi.fn(),
    setEdgeRubberBand: vi.fn(),
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

describe('DeleteEdgeInteraction', () => {
  it('Delete removes selected edges and clears selection', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [{ id: 'e1', from: 'a', to: 'b' }, { id: 'e2', from: 'b', to: 'c' }],
      selectedIds: ['e1', 'n1'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    expect(view.tabIndex).toBe(0)

    view.dispatch('keydown', { key: 'Delete' })
    expect(host.commitEdgeRemove).toHaveBeenCalledWith(['e1'])
    expect(host.setSelection).toHaveBeenCalledWith([])
    dispose()
  })

  it('ignores Delete when no selected edge', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      selectedIds: ['a'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    view.dispatch('keydown', { key: 'Delete' })
    expect(host.commitEdgeRemove).not.toHaveBeenCalled()
    dispose()
  })
})
