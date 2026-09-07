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
  /** Prefer horizontal vs vertical control points for the bezier. */
  readonly orientation?: 'horizontal' | 'vertical'
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
    ctx.beginPath()
    ctx.moveTo(view.from.x, view.from.y)
    if (view.orientation === 'horizontal') {
      const midX = (view.from.x + view.to.x) / 2
      ctx.bezierCurveTo(midX, view.from.y, midX, view.to.y, view.to.x, view.to.y)
    } else {
      const midY = (view.from.y + view.to.y) / 2
      ctx.bezierCurveTo(view.from.x, midY, view.to.x, midY, view.to.x, view.to.y)
    }
    ctx.strokeStyle = view.selected ? '#3b82f6' : '#5a6478'
    ctx.lineWidth = (view.selected ? 2 : 1.25) / this.viewport.zoom
    ctx.stroke()
    void edge
  }

  drawNode(node: GraphNode, view: NodePaintView): void {
    const { bounds } = view
    const ctx = this.rootCtx
    const data = node.data ?? {}
    const fill = typeof data.fill === 'string' ? data.fill : statusFill(node.status)
    const stroke = typeof data.stroke === 'string'
      ? data.stroke
      : view.selected || view.hovered ? '#3b82f6' : statusStroke(node.status)
    const labelColor = typeof data.labelColor === 'string' ? data.labelColor : '#e8eaed'
    const metaColor = typeof data.metaColor === 'string' ? data.metaColor : '#a8b0c0'
    const circular = node.type === 'tool' || data.shape === 'circle'
    if (circular) {
      const cx = bounds.x + bounds.width / 2
      const cy = bounds.y + bounds.height / 2
      const r = Math.min(bounds.width, bounds.height) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = (view.selected || node.status === 'active' ? 2.5 : 1.25) / this.viewport.zoom
      ctx.stroke()
      ctx.fillStyle = labelColor
      ctx.font = `${10 / this.viewport.zoom}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(truncate(node.label, 8), cx, cy)
      ctx.textAlign = 'start'
    } else {
      const radius = 8
      roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = (view.selected || node.status === 'active' ? 2.5 : 1.25) / this.viewport.zoom
      ctx.stroke()
      ctx.fillStyle = labelColor
      ctx.font = `${12 / this.viewport.zoom}px sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(truncate(node.label, 18), bounds.x + 12, bounds.y + bounds.height / 2 - 6)
      if (node.status !== undefined) {
        ctx.fillStyle = metaColor
        ctx.font = `${10 / this.viewport.zoom}px sans-serif`
        const meta = typeof data.meta === 'string' ? data.meta : node.status
        ctx.fillText(truncate(meta, 18), bounds.x + 12, bounds.y + bounds.height / 2 + 10)
      }
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
      return '#143528'
    case 'active':
      return '#3a2a10'
    case 'error':
      return '#3a1518'
    case 'cold':
      return '#1a1d24'
    case 'done':
      return '#143528'
    case 'idle':
      return '#1a2438'
    default:
      return '#1a1d24'
  }
}

function statusStroke(status: string | undefined): string {
  switch (status) {
    case 'running':
      return '#3dd68c'
    case 'active':
      return '#f5a524'
    case 'error':
      return '#f07178'
    case 'cold':
      return '#8b93a7'
    case 'done':
      return '#3dd68c'
    case 'idle':
      return '#5b8def'
    default:
      return '#334155'
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
