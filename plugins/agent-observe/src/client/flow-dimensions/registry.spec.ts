import { describe, expect, it } from 'vitest'
import {
  coerceFlowDimension,
  DEFAULT_FLOW_DIMENSION,
  FLOW_DIMENSIONS,
  resolveFlowDimension,
} from './registry.ts'

describe('flow dimension registry', () => {
  it('registers seven dimensions in tab order with architecture default', () => {
    expect(FLOW_DIMENSIONS.map(module => module.id)).toEqual([
      'architecture', 'process', 'integrated', 'panorama', 'loop', 'seam', 'events',
    ])
    expect(DEFAULT_FLOW_DIMENSION).toBe('architecture')
    expect(resolveFlowDimension('loop').id).toBe('loop')
    expect(coerceFlowDimension('nope')).toBe('architecture')
    expect(coerceFlowDimension('integrated')).toBe('integrated')
    expect(coerceFlowDimension('architecture')).toBe('architecture')
  })
})
