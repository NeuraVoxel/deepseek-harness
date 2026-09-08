import { describe, expect, it } from 'vitest'
import { fromPresetComposition } from './from-preset.ts'
import { modulesForEventType, unitIdsForModules } from './participation-map.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  isDefault: true,
  rows: [
    { entryId: 'compaction', moduleName: '@deepseek-ai/dsh-compaction', enabled: true },
    { entryId: 'tool-bash', moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true },
  ],
}

describe('modulesForEventType', () => {
  it('maps compaction and approval events; ignores unknown types', () => {
    expect(modulesForEventType('compaction/start')).toContain('@deepseek-ai/dsh-compaction')
    expect(modulesForEventType('approval/asked')).toContain('@deepseek-ai/dsh-user-approval')
    expect(modulesForEventType('turn/start')).toEqual([])
  })
})

describe('unitIdsForModules', () => {
  it('resolves composition units by moduleName', () => {
    const units = fromPresetComposition(preset).composition
    const ids = unitIdsForModules(units, ['@deepseek-ai/dsh-compaction'])
    expect(ids.has('standard:compaction')).toBe(true)
    expect(ids.has('standard:tool-bash')).toBe(false)
  })
})
