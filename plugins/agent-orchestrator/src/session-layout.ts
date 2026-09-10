/**
 * Session-local layout edits for OrchestrationDocument (F1 chrome, pre-CommitSink).
 */

import type { OrchestrationDocument, OrchestrationLayout } from './types.ts'

/** One node position in layout coordinates. */
export type LayoutPosition = { readonly x: number; readonly y: number }

/**
 * Merge a committed node move into layout positions.
 * @param layout - existing layout, or undefined when positions were grid-derived.
 * @param nodeId - moved unit id.
 * @param to - committed top-left after the gesture.
 * @returns new layout with `nodeId` updated (other keys preserved).
 */
export function applyNodeMovedToLayout(
  layout: OrchestrationLayout | undefined,
  nodeId: string,
  to: LayoutPosition,
): OrchestrationLayout {
  return {
    positions: {
      ...(layout?.positions ?? {}),
      [nodeId]: { x: to.x, y: to.y },
    },
  }
}

/**
 * Overlay session layout onto a document for canvas projection.
 * @param document - inventory-derived document.
 * @param layout - session positions keyed like `OrchestrationLayout.positions`.
 * @returns document with merged layout (same reference when layout empty).
 */
export function withSessionLayout(
  document: OrchestrationDocument,
  layout: OrchestrationLayout | undefined,
): OrchestrationDocument {
  if (layout === undefined || Object.keys(layout.positions).length === 0) return document
  const base = document.layout?.positions ?? {}
  return {
    ...document,
    layout: {
      positions: { ...base, ...layout.positions },
    },
  }
}
