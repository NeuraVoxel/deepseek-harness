import { describe, expect, it } from 'vitest'
import { fromPresetComposition, unitIdForRow } from './from-preset.ts'
import { layoutComposition, statusForEnablement, toGraphDocument } from './to-graph.ts'
import type { PresetCompositionInput } from './types.ts'

const sample: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  name: 'Standard',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true },
    { entryId: 'tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: false },
    { entryId: null, moduleName: '@deepseek-ai/dsh-tool-bash', enabled: 'conditional', condition: 'process.platform' },
  ],
}

describe('fromPresetComposition', () => {
  it('maps rows into locked composition units for system presets', () => {
    const doc = fromPresetComposition(sample)
    expect(doc.version).toBe(1)
    expect(doc.meta.kind).toBe('agent-preset-composition')
    expect(doc.meta.target).toBe('standard')
    expect(doc.composition).toHaveLength(3)
    expect(doc.composition[0]).toMatchObject({
      id: 'standard:persona',
      moduleName: '@deepseek-ai/dsh-persona',
      enabled: true,
      locked: true,
    })
    expect(unitIdForRow('standard', sample.rows[2]!, 2)).toBe('standard:row:2')
    expect(doc.composition[2]?.id).toBe('standard:row:2')
    expect(doc.catalog).toEqual([])
  })

  it('leaves user presets unlocked', () => {
    const doc = fromPresetComposition({ ...sample, trust: 'user', id: 'mine' })
    expect(doc.composition.every(unit => unit.locked === false)).toBe(true)
  })
})

describe('toGraphDocument', () => {
  const labels = {
    compositionGroup: 'Composition',
    empty: 'Empty',
    broken: 'Broken',
  }

  it('projects composition units into a group with enablement status', () => {
    const doc = fromPresetComposition(sample)
    const graph = toGraphDocument(doc, labels)
    expect(graph.version).toBe(1)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.groups?.[0]?.memberIds).toEqual(graph.nodes.map(node => node.id))
    expect(graph.groups?.[0]).toMatchObject({
      x: 24,
      y: 4,
      w: 456,
      h: 172,
    })
    expect(statusForEnablement(true)).toBe('active')
    expect(statusForEnablement(false)).toBe('idle')
    expect(statusForEnablement('conditional')).toBe('pending')
    expect(graph.nodes[0]?.status).toBe('active')
    expect(graph.nodes[1]?.status).toBe('idle')
    expect(graph.nodes[2]?.status).toBe('pending')
  })

  it('renders a broken note when meta.broken is set', () => {
    const doc = fromPresetComposition({
      ...sample,
      rows: [],
      broken: 'parse failed',
    })
    const graph = toGraphDocument(doc, labels)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]?.id).toBe('broken')
    expect(graph.nodes[0]?.data?.message).toBe('parse failed')
  })

  it('renders an empty note when composition has no rows', () => {
    const doc = fromPresetComposition({ ...sample, rows: [] })
    const graph = toGraphDocument(doc, labels)
    expect(graph.nodes[0]?.id).toBe('empty')
  })

  it('layoutComposition assigns distinct grid positions', () => {
    const positions = layoutComposition(fromPresetComposition(sample).composition, 2)
    expect(positions['standard:persona']).toEqual({ x: 40, y: 48 })
    expect(positions['standard:tool-fs']).toEqual({ x: 264, y: 48 })
  })
})
