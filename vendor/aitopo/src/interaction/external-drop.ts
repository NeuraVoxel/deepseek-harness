/**
 * HTML5 external drop — opaque catalog payload as `externalDrop` only.
 */

import type { Interaction, InteractionHost } from './types.ts'

/** Primary MIME for catalog drops; engines read this first. */
export const EXTERNAL_DROP_MIME_PLAIN = 'text/plain'

/**
 * Fallback MIME when `text/plain` is empty.
 * Hosts that set a dedicated type should also set `text/plain` when possible.
 */
export const EXTERNAL_DROP_MIME_AITOPO = 'application/aitopo-drop'

/**
 * Listen for HTML5 DnD on the view; emit opaque `externalDrop` (no auto addNode).
 */
export class ExternalDropInteraction implements Interaction {
  /**
   * Attach dragover/drop listeners on the view element.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const view = network.getViewElement()
    if (view === null) return () => {}

    const onDragOver = (event: DragEvent): void => {
      event.preventDefault()
    }

    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const transfer = event.dataTransfer
      if (transfer === null) return

      let data = transfer.getData(EXTERNAL_DROP_MIME_PLAIN)
      if (data === '') {
        data = transfer.getData(EXTERNAL_DROP_MIME_AITOPO)
      }

      const rect = view.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      const world = network.screenToWorld(screenX, screenY)
      const groupId = network.hitTestGroupScreen(screenX, screenY)

      network.emit({
        type: 'externalDrop',
        x: world.x,
        y: world.y,
        data,
        ...(groupId === undefined ? {} : { groupId }),
      })
    }

    view.addEventListener('dragover', onDragOver)
    view.addEventListener('drop', onDrop)

    return () => {
      view.removeEventListener('dragover', onDragOver)
      view.removeEventListener('drop', onDrop)
    }
  }
}
