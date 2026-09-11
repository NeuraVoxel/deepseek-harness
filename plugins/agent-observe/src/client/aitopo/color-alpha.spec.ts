/**
 * Unit tests for colorWithAlpha.
 */

import { describe, expect, it } from 'vitest'
import { colorWithAlpha } from './color-alpha.ts'

describe('colorWithAlpha', () => {
  it('leaves opaque colors unchanged at alpha 1', () => {
    expect(colorWithAlpha('#fb7185', 1)).toBe('#fb7185')
  })

  it('converts hex to rgba', () => {
    expect(colorWithAlpha('#ff0000', 0.2)).toBe('rgba(255, 0, 0, 0.2)')
    expect(colorWithAlpha('#f00', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('multiplies existing rgba alpha', () => {
    expect(colorWithAlpha('rgba(90, 100, 120, 0.08)', 0.2)).toBe('rgba(90, 100, 120, 0.016)')
  })
})
