/**
 * Renderer abstraction and Canvas 2D implementation.
 */

import type { Rect } from '../geom.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../protocol/types.ts'

/** Camera state passed into a frame. */
export interface ViewportState {
  readonly x: number
  readonly y: number
  readonly zoom: number
  readonly width: number
  readonly height: number
}

/** Cached geometry for a node paint. */
export interface NodePaintView {
  readonly bounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
}

/** Cached geometry for an edge paint. */
export interface EdgePaintView {
  readonly from: { x: number; y: number }
  readonly to: { x: number; y: number }
  readonly selected: boolean
}

/** Cached geometry for a group band. */
export interface GroupPaintView {
  readonly bounds: Rect
}

/**
 * Pluggable paint backend (Canvas2D now; WebGL later).
 */
export interface Renderer {
  beginFrame(viewport: ViewportState, dirty: readonly Rect[] | 'all'): void
  drawGroup(group: GraphGroup, view: GroupPaintView): void
  drawEdge(edge: GraphEdge, view: EdgePaintView): void
  drawNode(node: GraphNode, view: NodePaintView): void
  endFrame(): void
}

export interface Canvas2DRendererOptions {
  readonly root: HTMLCanvasElement
  readonly overlay: HTMLCanvasElement
  /** Stroke dirty unions when true. */
  debugPaintRects?: boolean
}

/**
 * Canvas 2D renderer with optional dirty-rect clipping on the root layer.
 */
export class Canvas2DRenderer implements Renderer {
  private readonly root: HTMLCanvasElement
  private readonly overlay: HTMLCanvasElement
  private readonly rootCtx: CanvasRenderingContext2D
  private readonly overlayCtx: CanvasRenderingContext2D
  private debugPaintRects: boolean
  private viewport: ViewportState = { x: 0, y: 0, zoom: 1, width: 1, height: 1 }
  private dirtyMode: readonly Rect[] | 'all' = 'all'

  constructor(options: Canvas2DRendererOptions) {
    this.root = options.root
    this.overlay = options.overlay
    const rootCtx = options.root.getContext('2d')
    const overlayCtx = options.overlay.getContext('2d')
    if (rootCtx === null || overlayCtx === null) {
      throw new Error('Canvas2DRenderer: 2d context unavailable')
    }
    this.rootCtx = rootCtx
    this.overlayCtx = overlayCtx
    this.debugPaintRects = options.debugPaintRects === true
  }

  setDebugPaintRects(value: boolean): void {
    this.debugPaintRects = value
  }

  beginFrame(viewport: ViewportState, dirty: readonly Rect[] | 'all'): void {
    this.viewport = viewport
    this.dirtyMode = dirty
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
    resizeCanvas(this.root, viewport.width, viewport.height, dpr)
    resizeCanvas(this.overlay, viewport.width, viewport.height, dpr)
    const ctx = this.rootCtx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewport.width, viewport.height)
    ctx.save()
    ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    ctx.scale(viewport.zoom, viewport.zoom)
    if (dirty !== 'all' && dirty.length > 0) {
      ctx.beginPath()
      for (const rect of dirty) {
        ctx.rect(rect.x, rect.y, rect.width, rect.height)
      }
      ctx.clip()
    }
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.overlayCtx.clearRect(0, 0, viewport.width, viewport.height)
    this.overlayCtx.save()
    this.overlayCtx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    this.overlayCtx.scale(viewport.zoom, viewport.zoom)
  }

  drawGroup(group: GraphGroup, view: GroupPaintView): void {
    const { bounds } = view
    const ctx = this.rootCtx
    ctx.fillStyle = 'rgba(90, 100, 120, 0.08)'
    ctx.strokeStyle = '#5a6478'
    ctx.lineWidth = 1 / this.viewport.zoom
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.fillStyle = '#5a6478'
    ctx.font = `${12 / this.viewport.zoom}px sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(group.label, bounds.x + 8, bounds.y + 6)
  }

  drawEdge(edge: GraphEdge, view: EdgePaintView): void {
    const ctx = this.rootCtx
    const midY = (view.from.y + view.to.y) / 2
    ctx.beginPath()
    ctx.moveTo(view.from.x, view.from.y)
    ctx.bezierCurveTo(view.from.x, midY, view.to.x, midY, view.to.x, view.to.y)
    ctx.strokeStyle = view.selected ? '#3b82f6' : '#5a6478'
    ctx.lineWidth = (view.selected ? 2 : 1.25) / this.viewport.zoom
    ctx.stroke()
    void edge
  }

  drawNode(node: GraphNode, view: NodePaintView): void {
    const { bounds } = view
    const ctx = this.rootCtx
    const radius = 8
    const fill = statusFill(node.status)
    roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = view.selected || view.hovered ? '#3b82f6' : '#334155'
    ctx.lineWidth = (view.selected ? 2.5 : 1.25) / this.viewport.zoom
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.font = `${13 / this.viewport.zoom}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(truncate(node.label, 22), bounds.x + 12, bounds.y + bounds.height / 2 - 6)
    if (node.status !== undefined) {
      ctx.fillStyle = '#64748b'
      ctx.font = `${11 / this.viewport.zoom}px sans-serif`
      ctx.fillText(node.status, bounds.x + 12, bounds.y + bounds.height / 2 + 10)
    }
    const alarm = node.alarms?.find(a => a.level === 'error') ?? node.alarms?.[0]
    if (alarm !== undefined) {
      const ax = bounds.x + bounds.width - 10
      const ay = bounds.y + 10
      ctx.beginPath()
      ctx.arc(ax, ay, 6, 0, Math.PI * 2)
      ctx.fillStyle = alarm.level === 'error' ? '#ef4444' : alarm.level === 'warn' ? '#f59e0b' : '#3b82f6'
      ctx.fill()
    }
  }

  endFrame(): void {
    if (this.debugPaintRects && this.dirtyMode !== 'all') {
      const ctx = this.overlayCtx
      ctx.save()
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.lineWidth = 1 / this.viewport.zoom
      for (const rect of this.dirtyMode) {
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      }
      ctx.restore()
    }
    this.rootCtx.restore()
    this.overlayCtx.restore()
  }

  /**
   * Draw selection strokes on the overlay canvas (call after beginFrame).
   * @param bounds - selected node bounds.
   */
  drawSelectionOverlay(bounds: Rect): void {
    const ctx = this.overlayCtx
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2 / this.viewport.zoom
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4)
  }
}

function resizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, dpr: number): void {
  const w = Math.max(1, Math.round(cssW * dpr))
  const h = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
}

function statusFill(status: string | undefined): string {
  switch (status) {
    case 'running':
    case 'active':
      return '#dbeafe'
    case 'error':
      return '#fee2e2'
    case 'cold':
      return '#f1f5f9'
    case 'done':
      return '#dcfce7'
    default:
      return '#ffffff'
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
