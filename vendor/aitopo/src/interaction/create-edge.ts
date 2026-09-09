/**
 * Alt+drag from a node to another node creates a directed edge (rubber-band preview).
 */

import type { Interaction, InteractionHost } from './types.ts'

const DRAG_THRESHOLD_PX = 4

export interface CreateEdgeInteractionOptions {
  /** Edge `kind` written on create (e.g. `data` / `control`). */
  readonly kind?: string
  /**
   * When true (default), require Alt on pointerdown to start linking.
   * Set false for exclusive link mode (demo toggle) that owns node drags.
   */
  readonly requireAlt?: boolean
}

/**
 * Create directed edges: Alt+drag (default) or exclusive mode without Alt.
 * Skips self-links and duplicate same-direction edges via `commitEdgeCreate`.
 */
export class CreateEdgeInteraction implements Interaction {
  private readonly kind: string | undefined
  private readonly requireAlt: boolean

  /**
   * @param options - optional kind and modifier policy.
   */
  constructor(options: CreateEdgeInteractionOptions = {}) {
    this.kind = options.kind
    this.requireAlt = options.requireAlt !== false
  }

  /**
   * Attach pointer listeners for edge create.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let active = false
    let dragged = false
    let fromId: string | undefined
    let startClientX = 0
    let startClientY = 0
    let capturedPointerId: number | null = null

    const nodeCenter = (id: string): { x: number; y: number } | undefined => {
      const node = network.getNode(id)
      if (node === undefined) return undefined
      const w = node.w ?? 100
      const h = node.h ?? 40
      return { x: (node.x ?? 0) + w / 2, y: (node.y ?? 0) + h / 2 }
    }

    const clearBand = (): void => {
      network.setEdgeRubberBand(undefined)
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

    const reset = (): void => {
      active = false
      dragged = false
      fromId = undefined
      capturedPointerId = null
      clearBand()
    }

    const abort = (): void => {
      releaseCapture()
      reset()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      if (this.requireAlt && !event.altKey) return
      if (!this.requireAlt && event.altKey) {
        // Exclusive mode still allows Alt for consistency when requireAlt is false.
      }
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit === undefined || hit.kind !== 'node') return
      if (network.getNode(hit.id) === undefined) return

      active = true
      dragged = false
      fromId = hit.id
      startClientX = event.clientX
      startClientY = event.clientY
      network.setSelection([hit.id])
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!active || fromId === undefined) return
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
      const from = nodeCenter(fromId)
      if (from === undefined) return
      const rect = canvas.getBoundingClientRect()
      const to = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      network.setEdgeRubberBand({ from, to })
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!active || fromId === undefined) return
      const sourceId = fromId
      if (dragged) {
        const rect = canvas.getBoundingClientRect()
        const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
        if (hit !== undefined && hit.kind === 'node' && hit.id !== sourceId) {
          network.commitEdgeCreate({
            from: sourceId,
            to: hit.id,
            ...(this.kind !== undefined ? { kind: this.kind } : {}),
          })
        }
        releaseCapture()
      }
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
