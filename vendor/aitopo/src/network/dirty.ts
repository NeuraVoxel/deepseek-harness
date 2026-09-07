/**
 * Dirty-rect accumulation for the Network paint loop.
 */

import { unionRect, type Rect } from '../geom.ts'

/** Accumulates world-space dirty rectangles and invalidate-all. */
export class DirtyAccumulator {
  private invalidateAll = false
  private union: Rect | undefined

  /** Mark the entire view dirty. */
  markAll(): void {
    this.invalidateAll = true
    this.union = undefined
  }

  /**
   * Union a world-space rect into the dirty region.
   * @param rect - element bounds.
   */
  add(rect: Rect): void {
    if (this.invalidateAll) return
    this.union = unionRect(this.union, rect)
  }

  /** Whether any paint is needed. */
  get dirty(): boolean {
    return this.invalidateAll || this.union !== undefined
  }

  /** True when the next paint must redraw the full canvas. */
  get isAll(): boolean {
    return this.invalidateAll
  }

  /** Current union, if partial. */
  get rect(): Rect | undefined {
    return this.union
  }

  /** Snapshot and clear. */
  take(): { invalidateAll: boolean; rect: Rect | undefined } {
    const snapshot = { invalidateAll: this.invalidateAll, rect: this.union }
    this.invalidateAll = false
    this.union = undefined
    return snapshot
  }
}
