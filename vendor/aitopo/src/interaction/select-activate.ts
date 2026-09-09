/**
 * Click / double-click selection and activation.
 */

import type { Interaction, InteractionHost } from './types.ts'

/** Select on pointer down; emit click / dblclick activation on pointer up unless a drag ran. */
export class SelectActivateInteraction implements Interaction {
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let lastClickAt = 0
    let lastClickId: string | undefined
    let pendingNodeId: string | undefined

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      network.clearGestureDragged()
      pendingNodeId = undefined
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit === undefined) {
        network.setSelection([])
        network.setHover(undefined)
        return
      }
      network.setSelection([hit.id])
      if (hit.kind === 'node') pendingNodeId = hit.id
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const nodeId = pendingNodeId
      pendingNodeId = undefined
      if (nodeId === undefined) return
      if (network.wasGestureDragged()) return
      const now = performance.now()
      const isDouble = lastClickId === nodeId && now - lastClickAt < 350
      lastClickAt = now
      lastClickId = nodeId
      network.activateNode(nodeId, isDouble ? 'dblclick' : 'click')
    }

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      network.setHover(hit?.id)
    }

    const onPointerLeave = (): void => {
      network.setHover(undefined)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
  }
}
