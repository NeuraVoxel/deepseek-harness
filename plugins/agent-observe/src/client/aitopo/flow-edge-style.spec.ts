/**
 * Dark-canvas edge / group style defaults.
 */

import { describe, expect, it } from 'vitest'
import {
  DARK_CANVAS_LABEL,
  DARK_FLOW_GROUP_STYLE,
  GROUP_OUTSIDE_LABEL_CLEARANCE,
  flowEdgeStyle,
  observeLayoutGroup,
} from './flow-edge-style.ts'

describe('flowEdgeStyle', () => {
  it('sets light edge label colors for the dark Observe canvas', () => {
    const style = flowEdgeStyle({ kind: 'data' })
    expect(style.label?.color).toBe(DARK_CANVAS_LABEL)
    expect(style.label2?.color).toBeDefined()
    expect(style.arrowTo).toBe(false)
  })

  it('keeps group title stroke light (AITopo paints titles with stroke)', () => {
    expect(DARK_FLOW_GROUP_STYLE.stroke).toMatch(/^#[0-9a-fA-F]{6}$/)
    // Not near-black — group titles must read on the dark canvas.
    expect(DARK_FLOW_GROUP_STYLE.stroke!.toLowerCase()).not.toBe('#000000')
    expect(DARK_FLOW_GROUP_STYLE.stroke!.toLowerCase()).not.toBe('#111111')
  })

  it('sets light top-left group labels and never truncates titles', () => {
    expect(DARK_FLOW_GROUP_STYLE.labelPosition).toBe('topLeft')
    expect(DARK_FLOW_GROUP_STYLE.label?.color).toBe(DARK_CANVAS_LABEL)
    expect(DARK_FLOW_GROUP_STYLE.label?.maxChars).toBe(0)
    const long = '① End-to-end architecture · full title'
    const group = observeLayoutGroup({
      id: 'g1',
      label: long,
      memberIds: ['a'],
      x: 10,
      y: 20,
      w: 100,
      h: 50,
      // Partial style must not wipe maxChars / label color via shallow merge.
      style: { stroke: '#abcdef' },
    })
    expect(group.label).toBe(long)
    expect(group.label.length).toBeGreaterThan(18)
    expect(group.style?.labelPosition).toBe('topLeft')
    expect(group.style?.label?.color).toBe(DARK_CANVAS_LABEL)
    expect(group.style?.label?.maxChars).toBe(0)
    expect(group.style?.stroke).toBe('#abcdef')
    expect(group.expanded).toBe(true)
    expect(group.style?.autoFit).toBe(false)
  })

  it('opens layout bands and disables autoFit so Observe owns geometry', () => {
    expect(DARK_FLOW_GROUP_STYLE.autoFit).toBe(false)
    expect(GROUP_OUTSIDE_LABEL_CLEARANCE).toBeGreaterThanOrEqual(28)
  })
})
