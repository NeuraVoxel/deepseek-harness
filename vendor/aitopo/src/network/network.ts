/**
 * Network: mount, RAF validate loop, protocol API, event fan-out.
 */

import { growRect, unionRect, type Rect } from '../geom.ts'
import { GraphScene } from '../model/scene.ts'
import type { GraphEvent } from '../protocol/events.ts'
import { graphPatchSchema } from '../protocol/schema.ts'
import type { GraphDocument, GraphViewport } from '../protocol/types.ts'
import { Canvas2DRenderer } from '../render/canvas2d.ts'
import type { Renderer } from '../render/canvas2d.ts'
import {
  edgeAnchors,
  groupBounds,
  hitTestNodes,
  nodeBounds,
} from '../ui/bounds.ts'
import {
  PanZoomInteraction,
  SelectActivateInteraction,
  type Interaction,
} from '../interaction/index.ts'
import { layoutFlowColumns, layoutGrid } from '../layout/index.ts'
import { DirtyAccumulator } from './dirty.ts'
import { Viewport } from './viewport.ts'

export type GraphEventHandler = (event: GraphEvent) => void

export interface NetworkOptions {
  /** Extra interactions beyond defaults. */
  readonly interactions?: readonly Interaction[]
  /** Attach default pan/zoom + select when true (default true). */
  readonly defaultInteractions?: boolean
  debugPaintRects?: boolean
}

/**
 * Host-facing Network: Document/Patch API + Canvas mount.
 */
export class Network {
  readonly scene = new GraphScene()
  readonly viewport = new Viewport()
  private readonly dirty = new DirtyAccumulator()
  private readonly listeners = new Set<GraphEventHandler>()
  private view: HTMLDivElement | null = null
  private rootCanvas: HTMLCanvasElement | null = null
  private renderer: Canvas2DRenderer | null = null
  private rafId = 0
  private needsPaint = true
  private disposed = false
  private resizeObserver: ResizeObserver | null = null
  private readonly disposers: Array<() => void> = []
  private readonly options: NetworkOptions
  private interactionModules: Interaction[] = []

  constructor(options: NetworkOptions = {}) {
    this.options = options
  }

  /**
   * Subscribe to GraphEvents.
   * @param handler - listener.
   * @returns unsubscribe.
   */
  on(handler: GraphEventHandler): () => void {
    this.listeners.add(handler)
    return () => { this.listeners.delete(handler) }
  }

  /**
   * @param input - GraphDocument or unknown JSON.
   */
  load(input: unknown): void {
    this.scene.load(input)
    const cam = this.scene.camera
    this.viewport.setCamera(cam)
    this.dirty.markAll()
    this.needsPaint = true
    this.emit({ type: 'documentChanged', reason: 'load' })
  }

  /** @returns active network document. */
  toJSON(): GraphDocument {
    return this.scene.toJSON()
  }

  /**
   * Apply a GraphPatch atomically.
   * @param patch - patch object with `ops`.
   */
  apply(patch: unknown): void {
    const parsed = graphPatchSchema.safeParse(patch)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(`GraphPatch parse failed: ${issue?.message ?? 'invalid'}`)
    }
    const nav = parsed.data.ops.find(op => op.op === 'enterSubNetwork' || op.op === 'exitSubNetwork')
    if (nav !== undefined) {
      if (parsed.data.ops.length !== 1) {
        throw new Error('SubNetwork navigation must be the only op in a patch')
      }
      if (nav.op === 'enterSubNetwork') this.enterSubNetwork(nav.id)
      else this.exitSubNetwork()
      return
    }
    const selection = parsed.data.ops.find(op => op.op === 'setSelection')
    this.scene.apply(parsed.data)
    this.syncDirtyFromScene()
    this.needsPaint = true
    if (selection?.op === 'setSelection') {
      this.scene.setSelection(selection.selectedIds)
      this.emit({ type: 'selectionChanged', selectedIds: selection.selectedIds })
    }
    this.emit({ type: 'documentChanged', reason: 'apply' })
  }

  /**
   * Run a named layout and emit layoutCompleted.
   * @param name - `grid` | `flow`.
   */
  layout(name: string): void {
    const doc = this.scene.toJSON()
    const positions = name === 'flow'
      ? layoutFlowColumns(doc)
      : name === 'grid'
        ? layoutGrid(doc)
        : (() => { throw new Error(`Unknown layout: ${name}`) })()
    this.scene.writePositions(positions)
    for (const [id, pos] of Object.entries(positions)) {
      const node = this.scene.nodes.get(id)
      if (node !== undefined) this.dirty.add(growRect(nodeBounds({ ...node, ...pos }), 4))
    }
    this.needsPaint = true
    this.emit({ type: 'layoutCompleted', name, positions })
  }

  /**
   * @param id - child network id under root `networks`.
   */
  enterSubNetwork(id: string): void {
    this.scene.enterSubNetwork(id)
    this.dirty.markAll()
    this.needsPaint = true
    this.emit({
      type: 'subNetworkChanged',
      activeNetworkId: this.scene.currentNetworkId,
      stack: this.scene.networkStack,
    })
  }

  exitSubNetwork(): void {
    this.scene.exitSubNetwork()
    this.dirty.markAll()
    this.needsPaint = true
    this.emit({
      type: 'subNetworkChanged',
      activeNetworkId: null,
      stack: [],
    })
  }

  /**
   * Mount into a parent element and start the RAF loop.
   * @param parent - host DOM node.
   */
  mount(parent: HTMLElement): void {
    if (this.view !== null) throw new Error('Network already mounted')
    this.disposed = false
    const view = document.createElement('div')
    view.className = 'aitopo-view'
    view.style.position = 'relative'
    view.style.width = '100%'
    view.style.height = '100%'
    view.style.overflow = 'hidden'
    view.style.touchAction = 'none'
    const root = document.createElement('canvas')
    const overlay = document.createElement('canvas')
    for (const canvas of [root, overlay]) {
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
    }
    overlay.style.pointerEvents = 'none'
    view.append(root, overlay)
    parent.appendChild(view)
    this.view = view
    this.rootCanvas = root
    this.renderer = new Canvas2DRenderer({
      root,
      overlay,
      ...(this.options.debugPaintRects === true ? { debugPaintRects: true } : {}),
    })
    this.syncSize()
    this.resizeObserver = new ResizeObserver(() => {
      this.syncSize()
      this.dirty.markAll()
      this.needsPaint = true
    })
    this.resizeObserver.observe(view)
    this.attachInteractions()
    const loop = (time: number): void => {
      void time
      if (this.disposed) return
      this.rafId = requestAnimationFrame(loop)
      if (this.needsPaint) this.validate()
    }
    this.rafId = requestAnimationFrame(loop)
  }

  /** Tear down DOM, RAF, and interactions. */
  destroy(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    for (const dispose of this.disposers.splice(0)) dispose()
    this.view?.remove()
    this.view = null
    this.rootCanvas = null
    this.renderer = null
  }

  /** Root view element (for interactions). */
  getViewElement(): HTMLDivElement | null {
    return this.view
  }

  /** Overlay is non-interactive; events bind to root canvas. */
  getHitElement(): HTMLCanvasElement | null {
    return this.rootCanvas
  }

  setDebugPaintRects(value: boolean): void {
    this.renderer?.setDebugPaintRects(value)
    this.needsPaint = true
    this.dirty.markAll()
  }

  /**
   * Select nodes and emit selectionChanged.
   * @param ids - selected ids.
   */
  setSelection(ids: readonly string[]): void {
    this.scene.setSelection(ids)
    this.needsPaint = true
    this.dirty.markAll()
    this.emit({ type: 'selectionChanged', selectedIds: ids })
  }

  /**
   * @param id - hovered node id or undefined.
   */
  setHover(id: string | undefined): void {
    this.scene.setHover(id)
    this.needsPaint = true
    this.emit({ type: 'hoverChanged', ...(id === undefined ? {} : { hoverId: id }) })
  }

  /**
   * Activate a node (click / dblclick).
   * @param nodeId - target.
   * @param detail - click kind.
   */
  activateNode(nodeId: string, detail: 'click' | 'dblclick'): void {
    this.emit({ type: 'nodeActivated', nodeId, detail })
  }

  /**
   * Update camera and emit viewportChanged.
   * @param mutate - mutates Viewport then syncs.
   */
  updateCamera(mutate: (viewport: Viewport) => void): void {
    mutate(this.viewport)
    const cam = this.viewport.state
    this.scene.setCamera({ x: cam.x, y: cam.y, zoom: cam.zoom })
    this.dirty.markAll()
    this.needsPaint = true
    this.emit({
      type: 'viewportChanged',
      viewport: { x: cam.x, y: cam.y, zoom: cam.zoom } satisfies GraphViewport,
    })
  }

  /** Hit-test at a screen point relative to the hit canvas. */
  hitTestScreen(screenX: number, screenY: number): { id: string } | undefined {
    const world = this.viewport.screenToWorld({ x: screenX, y: screenY })
    const nodes = [...this.scene.nodes.values()]
    const hit = hitTestNodes(world, nodes, 2 / this.viewport.state.zoom)
    return hit === undefined ? undefined : { id: hit.id }
  }

  private attachInteractions(): void {
    const defaults = this.options.defaultInteractions === false
      ? []
      : [new PanZoomInteraction(), new SelectActivateInteraction()]
    this.interactionModules = [...defaults, ...(this.options.interactions ?? [])]
    for (const interaction of this.interactionModules) {
      this.disposers.push(interaction.attach(this))
    }
  }

  private syncSize(): void {
    if (this.view === null) return
    const rect = this.view.getBoundingClientRect()
    this.viewport.setViewSize({
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    })
  }

  private syncDirtyFromScene(): void {
    const peek = this.scene.takeDirty()
    if (peek.invalidateAll) {
      this.dirty.markAll()
      return
    }
    for (const id of peek.ids) {
      const node = this.scene.nodes.get(id)
      if (node !== undefined) {
        this.dirty.add(growRect(nodeBounds(node), 8))
        continue
      }
      const edge = this.scene.edges.get(id)
      if (edge !== undefined) {
        const from = this.scene.nodes.get(edge.from)
        const to = this.scene.nodes.get(edge.to)
        if (from !== undefined && to !== undefined) {
          this.dirty.add(growRect(edgeAnchors(from, to).bounds, 8))
        }
        continue
      }
      const group = this.scene.groups.get(id)
      if (group !== undefined) this.dirty.add(growRect(groupBounds(group), 8))
    }
  }

  private validate(): void {
    const renderer: Renderer | null = this.renderer
    if (renderer === null) return
    this.needsPaint = false
    const cam = this.viewport.state
    const snapshot = this.dirty.take()
    const dirtyRects: Rect[] | 'all' = snapshot.invalidateAll
      ? 'all'
      : snapshot.rect === undefined ? 'all' : [snapshot.rect]

    try {
      renderer.beginFrame(cam, dirtyRects)
      for (const group of this.scene.groups.values()) {
        renderer.drawGroup(group, { bounds: groupBounds(group) })
      }
      for (const edge of this.scene.edges.values()) {
        const from = this.scene.nodes.get(edge.from)
        const to = this.scene.nodes.get(edge.to)
        if (from === undefined || to === undefined) continue
        const anchors = edgeAnchors(from, to)
        renderer.drawEdge(edge, {
          from: anchors.from,
          to: anchors.to,
          selected: this.scene.selectedIds.has(edge.id),
        })
      }
      for (const node of this.scene.nodes.values()) {
        const bounds = nodeBounds(node)
        renderer.drawNode(node, {
          bounds,
          selected: this.scene.selectedIds.has(node.id),
          hovered: this.scene.hover === node.id,
        })
        if (this.scene.selectedIds.has(node.id) && renderer instanceof Canvas2DRenderer) {
          renderer.drawSelectionOverlay(bounds)
        }
      }
      renderer.endFrame()
    } catch {
      // Paint failed: schedule a full-frame retry next tick.
      this.dirty.markAll()
      this.needsPaint = true
    }
  }

  private emit(event: GraphEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

/** Content union bounds for fit. */
export function contentBounds(scene: GraphScene): Rect | undefined {
  let bounds: Rect | undefined
  for (const node of scene.nodes.values()) {
    bounds = unionRect(bounds, nodeBounds(node))
  }
  for (const group of scene.groups.values()) {
    bounds = unionRect(bounds, groupBounds(group))
  }
  return bounds
}
