import { describe, expect, it } from 'vitest'
import {
  coerceFlowDimension,
  DEFAULT_FLOW_DIMENSION,
  FLOW_DIMENSIONS,
  resolveFlowDimension,
} from './registry.ts'

describe('flow dimension registry', () => {
  it('registers architecture, process, and events with architecture default', () => {
    expect(FLOW_DIMENSIONS.map(module => module.id)).toEqual([
      'architecture', 'process', 'events',
    ])
    expect(DEFAULT_FLOW_DIMENSION).toBe('architecture')
    expect(resolveFlowDimension('process').id).toBe('process')
    expect(coerceFlowDimension('nope')).toBe('architecture')
    expect(coerceFlowDimension('events')).toBe('events')
    expect(coerceFlowDimension('integrated')).toBe('architecture')
    expect(coerceFlowDimension('loop')).toBe('architecture')
  })
})
