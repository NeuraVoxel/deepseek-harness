/**
 * Build an OrchestrationDocument from a preset composition inventory group.
 */

import { resolveArchitecturalLayer } from './architectural-layer.ts'
import {
  ORCHESTRATION_DOCUMENT_VERSION,
  type OrchestrationDocument,
  type OrchestrationUnit,
  type PresetCompositionInput,
  type PresetCompositionRowInput,
} from './types.ts'

/**
 * Stable unit id for a composition row.
 * @param presetId - preset id.
 * @param row - inventory row.
 * @param index - row index when entryId is null.
 * @returns document-local unit id.
 */
export function unitIdForRow(
  presetId: string,
  row: PresetCompositionRowInput,
  index: number,
): string {
  if (row.entryId !== null && row.entryId.length > 0) return `${presetId}:${row.entryId}`
  return `${presetId}:row:${index}`
}

/**
 * Short canvas label for a composition row.
 * Mounted Loader entry ids nest with `:` (`delegation:tool-subagent`); show the leaf.
 * When entryId is absent, strip the `@deepseek-ai/dsh-` package prefix.
 * @param entryId - inventory entry id (may be hierarchical).
 * @param moduleName - module specifier.
 * @returns compact display label.
 */
export function displayLabelForRow(entryId: string | null, moduleName: string): string {
  if (entryId !== null && entryId.length > 0) {
    const leaf = entryId.includes(':') ? entryId.slice(entryId.lastIndexOf(':') + 1) : entryId
    if (leaf.length > 0) return leaf
  }
  const scoped = moduleName.match(/^@deepseek-ai\/dsh-(.+)$/)
  if (scoped?.[1] !== undefined && scoped[1].length > 0) return scoped[1]
  return moduleName
}

/**
 * Map one inventory group into an orchestration document.
 * System-trust rows are marked locked so F1 editors can refuse moves.
 * Units carry wiki/011 architectural layer for grouped canvas display.
 * @param preset - inventory group.
 * @returns orchestration document (composition = all named rows).
 */
export function fromPresetComposition(preset: PresetCompositionInput): OrchestrationDocument {
  const locked = preset.trust === 'system'
  const composition: OrchestrationUnit[] = preset.rows.map((row, index) => {
    const { layer, packageGroup } = resolveArchitecturalLayer(row.moduleName)
    return {
      id: unitIdForRow(preset.id, row, index),
      entryId: row.entryId,
      moduleName: row.moduleName,
      label: displayLabelForRow(row.entryId, row.moduleName),
      enabled: row.enabled,
      ...(row.condition !== undefined ? { condition: row.condition } : {}),
      ...(row.fiberPhase !== undefined ? { fiberPhase: row.fiberPhase } : {}),
      locked,
      layer,
      packageGroup,
    }
  })
  return {
    version: ORCHESTRATION_DOCUMENT_VERSION,
    meta: {
      kind: 'agent-preset-composition',
      target: preset.id,
      ...(preset.name !== undefined ? { title: preset.name } : {}),
      trust: preset.trust,
      isDefault: preset.isDefault,
      ...(preset.broken !== undefined ? { broken: preset.broken } : {}),
    },
    catalog: [],
    composition,
    constraints: [],
  }
}
