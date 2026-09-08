import { describe, expect, it } from 'vitest'
import { fromInventory } from './from-inventory.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  name: 'Standard',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
  ],
}

describe('fromInventory', () => {
  it('puts unmatched Loader entries in catalog and locks them', () => {
    const doc = fromInventory(preset, [
      { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    expect(doc.composition).toHaveLength(1)
    expect(doc.composition[0]?.id).toBe('standard:persona')
    expect(doc.catalog).toHaveLength(1)
    expect(doc.catalog[0]).toMatchObject({
      entryId: 'host-ui',
      moduleName: '@deepseek-ai/dsh-client',
      locked: true,
      label: 'host-ui',
    })
    expect(doc.catalog[0]?.id.startsWith('host:')).toBe(true)
  })

  it('dedupes by moduleName when entryId is null on the preset row', () => {
    const doc = fromInventory({
      ...preset,
      rows: [{ entryId: null, moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true }],
    }, [
      { entryId: 'bash', moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true, fiberPhase: 'active' },
    ])
    expect(doc.composition).toHaveLength(1)
    expect(doc.catalog).toEqual([])
  })
})
