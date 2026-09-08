/**
 * Document passed to canvas projection (may omit Host catalog).
 */

import type { OrchestrationDocument } from './types.ts'

/**
 * Document passed to canvas projection.
 * @param document - inventory-derived orchestration document.
 * @param includeHostCatalog - when false, omit Host-only catalog units.
 * @returns document for `toGraphDocument` (same reference when catalog included).
 */
export function documentForCanvas(
  document: OrchestrationDocument,
  includeHostCatalog: boolean,
): OrchestrationDocument {
  if (includeHostCatalog) return document
  return { ...document, catalog: [] }
}
