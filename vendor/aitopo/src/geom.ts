/**
 * Shared 2D geometry helpers for views and dirty-rect union.
 */

/** World-space point. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Axis-aligned rectangle in world space. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Union two rectangles; either may be undefined.
 * @param a - first rect.
 * @param b - second rect.
 * @returns union, or the defined side, or undefined.
 */
export function unionRect(a: Rect | undefined, b: Rect | undefined): Rect | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * Whether two rectangles intersect (edges touching counts).
 * @param a - first.
 * @param b - second.
 */
export function intersectsRect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x
    || b.x + b.width < a.x
    || a.y + a.height < b.y
    || b.y + b.height < a.y
  )
}

/**
 * Point-in-rect test with optional padding.
 * @param point - world point.
 * @param rect - target.
 * @param pad - expansion on each side.
 */
export function hitRect(point: Point, rect: Rect, pad = 0): boolean {
  return point.x >= rect.x - pad
    && point.x <= rect.x + rect.width + pad
    && point.y >= rect.y - pad
    && point.y <= rect.y + rect.height + pad
}

/**
 * Grow a rect by padding on each side.
 * @param rect - input.
 * @param pad - padding.
 */
export function growRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}
