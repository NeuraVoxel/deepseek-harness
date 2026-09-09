/**
 * Drag-move selected unlocked nodes with optional group membership on drop.
 */

import type { Interaction, InteractionHost } from './types.ts'

const DRAG_THRESHOLD_PX = 4

/** Live-move nodes; skip locked; reparent from group under pointer on commit. */
export class MoveNodeInteraction implements Interaction {
  /**
   * Attach pointer listeners for node move.
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
    let movers: { id: string; fromX: number; fromY: number }[] = []
    /** Pointer id held via setPointerCapture; null when none. */
    let capturedPointerId: number | null = null

    const reset = (): void => {
      active = false
      dragged = false
      movers = []
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

    /** Revert live previews to drag-start positions, release capture, clear state. */
    const abortWithoutCommit = (): void => {
      if (active && dragged) {
        for (const mover of movers) {
          network.previewNodePosition(mover.id, mover.fromX, mover.fromY)
        }
      }
      releaseCapture()
      reset()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit === undefined || hit.kind !== 'node') return
      if (network.getNode(hit.id) === undefined) return

      let selectedIds = network.getSelectedIds()
      if (!selectedIds.includes(hit.id)) {
        network.setSelection([hit.id])
        selectedIds = [hit.id]
      }

      const nextMovers: { id: string; fromX: number; fromY: number }[] = []
      for (const id of selectedIds) {
        const node = network.getNode(id)
        if (node === undefined || node.locked === true) continue
        nextMovers.push({
          id,
          fromX: node.x ?? 0,
          fromY: node.y ?? 0,
        })
      }
      if (nextMovers.length === 0) return

      active = true
      dragged = false
      startClientX = event.clientX
      startClientY = event.clientY
      movers = nextMovers
    }

    const previewAt = (clientX: number, clientY: number): void => {
      const zoom = network.viewport.state.zoom
      const dx = (clientX - startClientX) / zoom
      const dy = (clientY - startClientY) / zoom
      for (const mover of movers) {
        network.previewNodePosition(mover.id, mover.fromX + dx, mover.fromY + dy)
      }
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
      previewAt(event.clientX, event.clientY)
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!active) return
      if (dragged) {
        const zoom = network.viewport.state.zoom
        const dx = (event.clientX - startClientX) / zoom
        const dy = (event.clientY - startClientY) / zoom
        const rect = canvas.getBoundingClientRect()
        const groupHit = network.hitTestGroupScreen(
          event.clientX - rect.left,
          event.clientY - rect.top,
        )
        for (const mover of movers) {
          network.commitNodeMove({
            nodeId: mover.id,
            from: { x: mover.fromX, y: mover.fromY },
            to: { x: mover.fromX + dx, y: mover.fromY + dy },
            toGroupId: groupHit,
          })
        }
        releaseCapture()
      }
      reset()
    }

    const onPointerCancel = (): void => {
      abortWithoutCommit()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)

    return () => {
      abortWithoutCommit()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    }
  }
}
