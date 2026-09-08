/**
 * Interaction plugin contract (avoids importing Network class).
 */

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
