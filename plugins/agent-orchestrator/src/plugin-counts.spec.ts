import { describe, expect, it } from 'vitest'
import { documentForCanvas } from './document-for-canvas.ts'
import { fromInventory } from './from-inventory.ts'
import { pluginCountsFromDocument } from './plugin-counts.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true },
  ],
}

describe('pluginCountsFromDocument', () => {
  it('reports full catalog length even when canvas hides Host catalog', () => {
    const full = fromInventory(preset, [
      {
        entryId: 'persona',
        moduleName: '@deepseek-ai/dsh-persona',
        enabled: true,
        fiberPhase: 'active',
      },
      {
        entryId: 'host-ui',
        moduleName: '@deepseek-ai/dsh-client',
        enabled: true,
        fiberPhase: 'active',
      },
    ])
    expect(full.catalog).toHaveLength(1)
    const hidden = documentForCanvas(full, false)
    expect(hidden.catalog).toEqual([])
    expect(pluginCountsFromDocument(full)).toEqual({ composition: 1, catalog: 1 })
    expect(pluginCountsFromDocument(hidden)).toEqual({ composition: 1, catalog: 0 })
  })
})
