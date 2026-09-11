/**
 * Ordered Agent Flow dimension registry.
 */

import { eventsDimension } from './events/index.ts'
import { loopDimension } from './loop/index.ts'
import { panoramaDimension } from './panorama/index.ts'
import { processDimension } from './process/index.ts'
import { seamDimension } from './seam/index.ts'
import type { FlowDimensionId, FlowDimensionModule } from './types.ts'

/** Default Flow dimension (first tab). */
export const DEFAULT_FLOW_DIMENSION: FlowDimensionId = 'process'

/** Registered dimensions in tab order. */
export const FLOW_DIMENSIONS: readonly FlowDimensionModule[] = [
  processDimension,
  panoramaDimension,
  loopDimension,
  seamDimension,
  eventsDimension,
]

const byId = new Map(FLOW_DIMENSIONS.map(module => [module.id, module]))

/**
 * @param id - dimension id from nav state.
 * @returns module or the default process module when unknown.
 */
export function resolveFlowDimension(id: FlowDimensionId): FlowDimensionModule {
  return byId.get(id) ?? processDimension
}

/**
 * @param value - raw nav / UI value.
 * @returns a known dimension id (falls back to process).
 */
export function coerceFlowDimension(value: string | null | undefined): FlowDimensionId {
  if (value === 'process' || value === 'panorama' || value === 'loop'
    || value === 'seam' || value === 'events') {
    return value
  }
  return DEFAULT_FLOW_DIMENSION
}
