/**
 * Physical zoom viewport (world ↔ screen).
 */

import type { Point, Rect } from '../geom.ts'
import type { GraphViewport } from '../protocol/types.ts'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

/** View size in CSS pixels. */
export interface ViewSize {
  readonly width: number
  readonly height: number
}

/** Mutable camera controller. */
export class Viewport {
  private x = 0
  private y = 0
  private zoom = 1
  private width = 1
  private height = 1

  get state(): GraphViewport & ViewSize {
    return { x: this.x, y: this.y, zoom: this.zoom, width: this.width, height: this.height }
  }

  /**
   * @param size - CSS pixel size of the stage.
   */
  setViewSize(size: ViewSize): void {
    this.width = Math.max(1, size.width)
    this.height = Math.max(1, size.height)
  }

  /**
   * @param zoom - absolute zoom factor.
   */
  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  }

  /**
   * Zoom toward a screen point.
   * @param screen - CSS pixel point relative to stage.
   * @param nextZoom - target zoom.
   */
  zoomAt(screen: Point, nextZoom: number): void {
    const before = this.screenToWorld(screen)
    this.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const after = this.screenToWorld(screen)
    this.x += before.x - after.x
    this.y += before.y - after.y
  }

  /**
   * @param dx - world delta x.
   * @param dy - world delta y.
   */
  panBy(dx: number, dy: number): void {
    this.x += dx
    this.y += dy
  }

  /**
   * Fit content bounds into the view with padding.
   * @param bounds - world content.
   * @param padding - CSS pixels.
   */
  fitBounds(bounds: Rect, padding = 24): void {
    const availW = Math.max(1, this.width - padding * 2)
    const availH = Math.max(1, this.height - padding * 2)
    const zoom = clamp(
      Math.min(availW / Math.max(1, bounds.width), availH / Math.max(1, bounds.height)),
      MIN_ZOOM,
      MAX_ZOOM,
    )
    this.zoom = zoom
    this.x = bounds.x - (this.width / zoom - bounds.width) / 2
    this.y = bounds.y - (this.height / zoom - bounds.height) / 2
  }

  /**
   * @param screen - CSS pixel point.
   * @returns world point.
   */
  screenToWorld(screen: Point): Point {
    return {
      x: screen.x / this.zoom + this.x,
      y: screen.y / this.zoom + this.y,
    }
  }

  /**
   * @param world - world point.
   * @returns screen point.
   */
  worldToScreen(world: Point): Point {
    return {
      x: (world.x - this.x) * this.zoom,
      y: (world.y - this.y) * this.zoom,
    }
  }

  /**
   * Replace camera from a document viewport.
   * @param camera - persisted viewport.
   */
  setCamera(camera: GraphViewport): void {
    this.x = camera.x
    this.y = camera.y
    this.zoom = clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export { MAX_ZOOM, MIN_ZOOM }
