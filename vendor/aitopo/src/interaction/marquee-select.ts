/**
 * Shift+empty-space drag: marquee select by intersecting node bounds.
 */

import { intersectsRect, type Rect } from '../geom.ts'
import { nodeBounds } from '../ui/bounds.ts'
import type { Interaction, InteractionHost } from './types.ts'

const DRAG_THRESHOLD_PX = 4

/** Normalize a drag start→current pair into a positive-size world rect. */
function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x, b.x) - x,
    height: Math.max(a.y, b.y) - y,
  }
}

/**
 * Marquee selection: Shift+primary drag on empty space.
 * Unmodified empty drag stays with PanZoom. Locked nodes may be selected.
 */
export class MarqueeSelectInteraction implements Interaction {
  /**
   * Attach pointer listeners for Shift-marquee select.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let active = false
    let dragged = false
    let startClientX = 0
    let startClientY = 0
    let startWorld = { x: 0, y: 0 }
    /** Pointer id held via setPointerCapture; null when none. */
    let capturedPointerId: number | null = null

    const reset = (): void => {
      active = false
      dragged = false
      capturedPointerId = null
    }

    const releaseCapture = (): void => {
      if (capturedPointerId === null) return
      try {
        canvas.releasePointerCapture(capturedPointerId)
      } catch {
        // Pointer already released.
      }
      capturedPointerId = null
    }

    const clearMarquee = (): void => {
      network.setMarqueeRect(undefined)
    }

    const abort = (): void => {
      if (active) clearMarquee()
      releaseCapture()
      reset()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || !event.shiftKey) return
      const rect = canvas.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      if (network.hitTestScreen(screenX, screenY) !== undefined) return

      active = true
      dragged = false
      startClientX = event.clientX
      startClientY = event.clientY
      startWorld = network.screenToWorld(screenX, screenY)
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!active) return
      if (!dragged) {
        const dist = Math.hypot(event.clientX - startClientX, event.clientY - startClientY)
        if (dist < DRAG_THRESHOLD_PX) return
        dragged = true
        network.markGestureDragged()
        try {
          canvas.setPointerCapture(event.pointerId)
          capturedPointerId = event.pointerId
        } catch {
          // Capture unsupported or already held.
        }
      }
      const rect = canvas.getBoundingClientRect()
      const current = network.screenToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
      )
      network.setMarqueeRect(rectFromPoints(startWorld, current))
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!active) return
      if (dragged) {
        const rect = canvas.getBoundingClientRect()
        const current = network.screenToWorld(
          event.clientX - rect.left,
          event.clientY - rect.top,
        )
        const marquee = rectFromPoints(startWorld, current)
        const ids: string[] = []
        for (const node of network.getNodes()) {
          if (intersectsRect(marquee, nodeBounds(node))) ids.push(node.id)
        }
        network.setSelection(ids)
        releaseCapture()
      }
      clearMarquee()
      reset()
    }

    const onPointerCancel = (): void => {
      abort()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)

    return () => {
      abort()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    }
  }
}
