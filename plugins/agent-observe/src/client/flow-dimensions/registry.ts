/**
 * Ordered Agent Flow dimension registry.
 */

import { architectureDimension } from './architecture/index.ts'
import { dataflowDimension } from './dataflow/index.ts'
import { eventsDimension } from './events/index.ts'
import { processDimension } from './process/index.ts'
import type { FlowDimensionId, FlowDimensionModule } from './types.ts'

/** Default Flow dimension (first tab). */
export const DEFAULT_FLOW_DIMENSION: FlowDimensionId = 'architecture'

/** Registered dimensions in tab order. */
export const FLOW_DIMENSIONS: readonly FlowDimensionModule[] = [
  architectureDimension,
  dataflowDimension,
  processDimension,
  eventsDimension,
]

const byId = new Map(FLOW_DIMENSIONS.map(module => [module.id, module]))

/**
 * @param id - dimension id from nav state.
 * @returns module or the default architecture module when unknown.
 */
export function resolveFlowDimension(id: FlowDimensionId): FlowDimensionModule {
  return byId.get(id) ?? architectureDimension
}

/**
 * @param value - raw nav / UI value.
 * @returns a known dimension id (falls back to the default architecture tab).
 */
export function coerceFlowDimension(value: string | null | undefined): FlowDimensionId {
  if (value === 'architecture' || value === 'dataflow' || value === 'process'
    || value === 'events') {
    return value
  }
  return DEFAULT_FLOW_DIMENSION
}
