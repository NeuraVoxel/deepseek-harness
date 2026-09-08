/**
 * Build an OrchestrationDocument from a preset group plus Host Loader entries.
 */

import { resolveArchitecturalLayer } from './architectural-layer.ts'
import { displayLabelForRow, fromPresetComposition } from './from-preset.ts'
import type {
  OrchestrationDocument,
  OrchestrationFiberPhase,
  OrchestrationUnit,
  PresetCompositionInput,
} from './types.ts'

/** Narrow Loader entry input from pluginInventory `entries`. */
export interface HostLoaderEntryInput {
  readonly entryId: string
  readonly moduleName: string
  readonly enabled: boolean
  readonly fiberPhase: OrchestrationFiberPhase
}

/**
 * Whether a composition unit already represents a Loader entry.
 * Prefer entryId when both sides have a non-empty id; otherwise compare moduleName.
 * @param unit - composition unit.
 * @param entry - Host Loader entry.
 * @returns true when the entry must stay out of catalog.
 */
export function matchesComposition(
  unit: OrchestrationUnit,
  entry: HostLoaderEntryInput,
): boolean {
  const unitId = unit.entryId
  if (unitId !== null && unitId.length > 0 && entry.entryId.length > 0) {
    return unitId === entry.entryId
  }
  return unit.moduleName === entry.moduleName
}

/**
 * Stable catalog unit id for a Host Loader entry.
 * @param entryId - Loader entry id.
 * @returns document-local unit id.
 */
export function unitIdForHostEntry(entryId: string): string {
  return `host:${entryId}`
}

/**
 * Map one preset plus Host Loader entries into an orchestration document.
 * Composition comes from the preset; catalog holds Loader entries that do not
 * match any composition unit (dedupe by entryId or moduleName).
 * @param preset - inventory group.
 * @param entries - current Loader non-group entries.
 * @returns orchestration document with composition and Host-only catalog.
 */
export function fromInventory(
  preset: PresetCompositionInput,
  entries: readonly HostLoaderEntryInput[],
): OrchestrationDocument {
  const base = fromPresetComposition(preset)
  const catalog: OrchestrationUnit[] = []
  for (const entry of entries) {
    if (base.composition.some(unit => matchesComposition(unit, entry))) continue
    const { layer, packageGroup } = resolveArchitecturalLayer(entry.moduleName)
    catalog.push({
      id: unitIdForHostEntry(entry.entryId),
      entryId: entry.entryId,
      moduleName: entry.moduleName,
      label: displayLabelForRow(entry.entryId, entry.moduleName),
      enabled: entry.enabled,
      fiberPhase: entry.fiberPhase,
      locked: true,
      layer,
      packageGroup,
    })
  }
  return { ...base, catalog }
}
