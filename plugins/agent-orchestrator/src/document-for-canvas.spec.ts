import { describe, expect, it } from 'vitest'
import { documentForCanvas } from './document-for-canvas.ts'
import { fromInventory } from './from-inventory.ts'
import { toGraphDocument } from './to-graph.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true },
  ],
}

const labels = {
  layerGroup: (layer: string) => layer,
  empty: 'Empty',
  broken: 'Broken',
}

describe('documentForCanvas', () => {
  it('hides catalog when includeHostCatalog is false', () => {
    const full = fromInventory(preset, [
      { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    expect(full.catalog).toHaveLength(1)
    const hidden = documentForCanvas(full, false)
    expect(hidden.catalog).toEqual([])
    expect(hidden.composition).toEqual(full.composition)
    const graph = toGraphDocument(hidden, labels)
    expect(graph.nodes.some(n => n.id.startsWith('host:'))).toBe(false)
  })

  it('keeps catalog when includeHostCatalog is true', () => {
    const full = fromInventory(preset, [
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    const shown = documentForCanvas(full, true)
    expect(shown.catalog).toEqual(full.catalog)
  })
})
