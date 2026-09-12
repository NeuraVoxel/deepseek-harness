import { describe, expect, it } from 'vitest'
import {
  coerceFlowDimension,
  DEFAULT_FLOW_DIMENSION,
  FLOW_DIMENSIONS,
  resolveFlowDimension,
} from './registry.ts'

describe('flow dimension registry', () => {
  it('registers architecture, dataflow, process, and events with architecture default', () => {
    expect(FLOW_DIMENSIONS.map(module => module.id)).toEqual([
      'architecture', 'dataflow', 'process', 'events',
    ])
    expect(DEFAULT_FLOW_DIMENSION).toBe('architecture')
    expect(resolveFlowDimension('dataflow').id).toBe('dataflow')
    expect(coerceFlowDimension('nope')).toBe('architecture')
    expect(coerceFlowDimension('dataflow')).toBe('dataflow')
    expect(coerceFlowDimension('integrated')).toBe('architecture')
  })
})
