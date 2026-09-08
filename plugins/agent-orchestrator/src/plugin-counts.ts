/**
 * Preset vs Host-loaded counts from a full orchestration document.
 */

import type { OrchestrationDocument } from './types.ts'

/** Counts for the Orchestrate toolbar (always from the inventory document). */
export interface PluginCounts {
  /** Units in the selected Preset composition. */
  readonly composition: number
  /** Host-loaded units not in that Preset (`catalog`). */
  readonly catalog: number
}

/**
 * Plugin counts for toolbar display.
 * @param document - inventory-derived orchestration document (full catalog).
 * @returns composition and Host-only catalog lengths.
 */
export function pluginCountsFromDocument(document: OrchestrationDocument): PluginCounts {
  return {
    composition: document.composition.length,
    catalog: document.catalog.length,
  }
}
