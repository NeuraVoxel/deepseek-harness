/**
 * Interaction plugin contract (avoids importing Network class).
 */

import type { GraphEvent } from '../protocol/events.ts'
import type { GraphPatch } from '../protocol/patch.ts'
import type { GraphGroup, GraphNode } from '../protocol/types.ts'

/** Minimal host surface interactions bind to. */
export interface InteractionHost {
  getViewElement(): HTMLDivElement | null
  getHitElement(): HTMLCanvasElement | null
  hitTestScreen(screenX: number, screenY: number): { id: string; kind: 'node' | 'edge' } | undefined
  setSelection(ids: readonly string[]): void
  setHover(id: string | undefined): void
  activateNode(nodeId: string, detail: 'click' | 'dblclick'): void
  updateCamera(mutate: (viewport: import('../network/viewport.ts').Viewport) => void): void
  readonly viewport: import('../network/viewport.ts').Viewport
  /** @param id - node id. @returns node or undefined. */
  getNode(id: string): GraphNode | undefined
  /** @returns groups in the active network. */
  getGroups(): readonly GraphGroup[]
  /** @returns selected element ids. */
  getSelectedIds(): readonly string[]
  /**
   * Hit-test groups at a screen point.
   * @param screenX - CSS x relative to the hit canvas.
   * @param screenY - CSS y relative to the hit canvas.
   * @returns topmost / smallest-area group id, or undefined.
   */
  hitTestGroupScreen(screenX: number, screenY: number): string | undefined
  /**
   * @param screenX - CSS x relative to the hit canvas.
   * @param screenY - CSS y relative to the hit canvas.
   * @returns world point.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number }
  /** Live preview during drag (does not emit nodeMoved). */
  previewNodePosition(id: string, x: number, y: number): void
  /**
   * Commit move: apply updateNode, optional membership patch, emit nodeMoved
   * and groupMembershipChanged when membership changes.
   */
  commitNodeMove(args: {
    nodeId: string
    from: { x: number; y: number }
    to: { x: number; y: number }
    toGroupId?: string | undefined
  }): void
  /** Mark that a drag consumed this pointer gesture (SelectActivate skips activate). */
  markGestureDragged(): void
  /** @returns true when markGestureDragged ran since the last clear. */
  wasGestureDragged(): boolean
  /** Reset the drag-consumed flag (call at pointerdown). */
  clearGestureDragged(): void
  /**
   * Fan out a GraphEvent to subscribers.
   * @param event - event payload.
   */
  emit(event: GraphEvent): void
  /**
   * Apply a GraphPatch atomically.
   * @param patch - patch object with `ops`.
   */
  apply(patch: GraphPatch): void
}

/** Pluggable pointer / wheel behavior. */
export interface Interaction {
  /**
   * Attach listeners to the network view.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void
}
