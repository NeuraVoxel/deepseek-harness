/**
 * Wheel zoom and empty-space pan.
 */

import type { Interaction, InteractionHost } from './types.ts'

/** Pan on primary drag over empty space; wheel zooms toward pointer. */
export class PanZoomInteraction implements Interaction {
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let dragging = false
    let lastX = 0
    let lastY = 0
    let moved = false

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      network.updateCamera(viewport => {
        viewport.zoomAt(screen, viewport.state.zoom * factor)
      })
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      // Shift+empty drag is MarqueeSelect; leave unmodified empty drag as pan.
      if (event.shiftKey) return
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit !== undefined) return
      dragging = true
      moved = false
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return
      const dx = (event.clientX - lastX) / network.viewport.state.zoom
      const dy = (event.clientY - lastY) / network.viewport.state.zoom
      lastX = event.clientX
      lastY = event.clientY
      if (dx !== 0 || dy !== 0) moved = true
      network.updateCamera(viewport => {
        viewport.panBy(-dx, -dy)
      })
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!dragging) return
      dragging = false
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Pointer already released.
      }
      void moved
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }
}
