import { describe, expect, it } from 'vitest'
import {
  coerceFlowDimension,
  DEFAULT_FLOW_DIMENSION,
  FLOW_DIMENSIONS,
  resolveFlowDimension,
} from './registry.ts'

describe('flow dimension registry', () => {
  it('registers five dimensions in tab order with process default', () => {
    expect(FLOW_DIMENSIONS.map(module => module.id)).toEqual([
      'process', 'panorama', 'loop', 'seam', 'events',
    ])
    expect(DEFAULT_FLOW_DIMENSION).toBe('process')
    expect(resolveFlowDimension('loop').id).toBe('loop')
    expect(coerceFlowDimension('nope')).toBe('process')
  })
})
