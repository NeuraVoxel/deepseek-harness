import { describe, expect, it, vi } from 'vitest'
import {
  EXTERNAL_DROP_MIME_AITOPO,
  EXTERNAL_DROP_MIME_PLAIN,
  ExternalDropInteraction,
} from '../src/interaction/external-drop.ts'
import type { InteractionHost } from '../src/interaction/types.ts'

/** Minimal EventTarget-like view for node-env ExternalDrop tests. */
class FakeViewElement {
  private readonly listeners = new Map<string, Set<(event: DragEvent) => void>>()

  addEventListener(type: string, listener: (event: DragEvent) => void): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: DragEvent) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 220,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    }
  }

  dispatch(
    type: string,
    partial: {
      clientX: number
      clientY: number
      dataTransfer: DataTransfer | null
      preventDefault: ReturnType<typeof vi.fn>
    },
  ): void {
    const event = partial as unknown as DragEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function fakeDataTransfer(entries: Record<string, string>): DataTransfer {
  return {
    getData: (mime: string) => entries[mime] ?? '',
  } as DataTransfer
}

function createHost(options: {
  view: FakeViewElement
  groupId?: string | undefined
  screenToWorld?: (x: number, y: number) => { x: number; y: number }
}): InteractionHost & {
  emit: ReturnType<typeof vi.fn>
  apply: ReturnType<typeof vi.fn>
  hitTestGroupScreen: ReturnType<typeof vi.fn>
  screenToWorld: ReturnType<typeof vi.fn>
} {
  const emit = vi.fn()
  const apply = vi.fn()
  const hitTestGroupScreen = vi.fn((_x: number, _y: number) => options.groupId)
  const screenToWorld = vi.fn(
    options.screenToWorld ?? ((x: number, y: number) => ({ x: x * 2, y: y * 3 })),
  )

  return {
    getViewElement: () => options.view as unknown as HTMLDivElement,
    getHitElement: () => null,
    hitTestScreen: () => undefined,
    setSelection: vi.fn(),
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: () => undefined,
    getNodes: () => [],
    getGroups: () => [],
    getSelectedIds: () => [],
    hitTestGroupScreen,
    screenToWorld,
    previewNodePosition: vi.fn(),
    commitNodeMove: vi.fn(),
    markGestureDragged: vi.fn(),
    wasGestureDragged: () => false,
    clearGestureDragged: vi.fn(),
    setMarqueeRect: vi.fn(),
    emit,
    apply,
  }
}

describe('ExternalDropInteraction', () => {
  it('prevents default on dragover', () => {
    const view = new FakeViewElement()
    const host = createHost({ view })
    const dispose = new ExternalDropInteraction().attach(host)
    const preventDefault = vi.fn()

    view.dispatch('dragover', {
      clientX: 50,
      clientY: 60,
      dataTransfer: null,
      preventDefault,
    })

    expect(preventDefault).toHaveBeenCalledOnce()
    dispose()
  })

  it('emits externalDrop with world coords and opaque text/plain data', () => {
    const view = new FakeViewElement()
    const host = createHost({ view })
    const dispose = new ExternalDropInteraction().attach(host)
    const preventDefault = vi.fn()

    // client (50, 60) − rect (10, 20) → screen (40, 40) → world (80, 120)
    view.dispatch('drop', {
      clientX: 50,
      clientY: 60,
      dataTransfer: fakeDataTransfer({ [EXTERNAL_DROP_MIME_PLAIN]: 'catalog:shell' }),
      preventDefault,
    })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(host.screenToWorld).toHaveBeenCalledWith(40, 40)
    expect(host.hitTestGroupScreen).toHaveBeenCalledWith(40, 40)
    expect(host.emit).toHaveBeenCalledWith({
      type: 'externalDrop',
      x: 80,
      y: 120,
      data: 'catalog:shell',
    })
    expect(host.apply).not.toHaveBeenCalled()
    dispose()
  })

  it('falls back to application/aitopo-drop when text/plain is empty', () => {
    const view = new FakeViewElement()
    const host = createHost({ view })
    const dispose = new ExternalDropInteraction().attach(host)

    view.dispatch('drop', {
      clientX: 10,
      clientY: 20,
      dataTransfer: fakeDataTransfer({
        [EXTERNAL_DROP_MIME_PLAIN]: '',
        [EXTERNAL_DROP_MIME_AITOPO]: 'opaque-bytes',
      }),
      preventDefault: vi.fn(),
    })

    expect(host.emit).toHaveBeenCalledWith({
      type: 'externalDrop',
      x: 0,
      y: 0,
      data: 'opaque-bytes',
    })
    dispose()
  })

  it('includes groupId from hitTestGroupScreen when over a group', () => {
    const view = new FakeViewElement()
    const host = createHost({ view, groupId: 'g1' })
    const dispose = new ExternalDropInteraction().attach(host)

    view.dispatch('drop', {
      clientX: 30,
      clientY: 40,
      dataTransfer: fakeDataTransfer({ [EXTERNAL_DROP_MIME_PLAIN]: 'catalog:shell' }),
      preventDefault: vi.fn(),
    })

    expect(host.emit).toHaveBeenCalledWith({
      type: 'externalDrop',
      x: 40,
      y: 60,
      data: 'catalog:shell',
      groupId: 'g1',
    })
    dispose()
  })

  it('prefers text/plain over application/aitopo-drop when both set', () => {
    const view = new FakeViewElement()
    const host = createHost({ view })
    const dispose = new ExternalDropInteraction().attach(host)

    view.dispatch('drop', {
      clientX: 10,
      clientY: 20,
      dataTransfer: fakeDataTransfer({
        [EXTERNAL_DROP_MIME_PLAIN]: 'from-plain',
        [EXTERNAL_DROP_MIME_AITOPO]: 'from-aitopo',
      }),
      preventDefault: vi.fn(),
    })

    expect(host.emit).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'from-plain' }),
    )
    dispose()
  })

  it('no-ops when getViewElement is null', () => {
    const emit = vi.fn()
    const host = createHost({ view: new FakeViewElement() })
    host.getViewElement = () => null
    host.emit = emit
    const dispose = new ExternalDropInteraction().attach(host)
    dispose()
    expect(emit).not.toHaveBeenCalled()
  })
})
