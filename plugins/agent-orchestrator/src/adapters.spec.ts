import { describe, expect, it } from 'vitest'
import { resolveArchitecturalLayer } from './architectural-layer.ts'
import { fromInventory } from './from-inventory.ts'
import { displayLabelForRow, fromPresetComposition, unitIdForRow } from './from-preset.ts'
import {
  layoutByArchitecturalLayer,
  layoutComposition,
  statusForEnablement,
  styleForEnablement,
  toGraphDocument,
} from './to-graph.ts'
import type { PresetCompositionInput } from './types.ts'

const sample: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  name: 'Standard',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
    { entryId: 'tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: false, fiberPhase: null },
    { entryId: null, moduleName: '@deepseek-ai/dsh-tool-bash', enabled: 'conditional', condition: 'process.platform' },
  ],
}

describe('resolveArchitecturalLayer', () => {
  it('maps known packages to wiki layers and package groups', () => {
    expect(resolveArchitecturalLayer('@deepseek-ai/dsh-persona')).toEqual({
      layer: 'model-context',
      packageGroup: 'preset',
    })
    expect(resolveArchitecturalLayer('@deepseek-ai/dsh-tool-fs')).toEqual({
      layer: 'execution',
      packageGroup: 'fs',
    })
    expect(resolveArchitecturalLayer('@deepseek-ai/dsh-agent-instructions')).toEqual({
      layer: 'model-context',
      packageGroup: 'context',
    })
  })

  it('falls back to other for unknown modules', () => {
    expect(resolveArchitecturalLayer('../../plugins/contribute.js')).toEqual({
      layer: 'other',
      packageGroup: null,
    })
  })
})

describe('displayLabelForRow', () => {
  it('uses the leaf of nested Loader entry ids', () => {
    expect(displayLabelForRow('delegation:tool-subagent-claude-code', '@deepseek-ai/dsh-tool-subagent'))
      .toBe('tool-subagent-claude-code')
    expect(displayLabelForRow('persona', '@deepseek-ai/dsh-persona')).toBe('persona')
  })

  it('falls back to a short package name when entryId is null', () => {
    expect(displayLabelForRow(null, '@deepseek-ai/dsh-tool-bash')).toBe('tool-bash')
  })
})

describe('fromPresetComposition', () => {
  it('maps rows into locked composition units for system presets', () => {
    const doc = fromPresetComposition(sample)
    expect(doc.version).toBe(1)
    expect(doc.meta.kind).toBe('agent-preset-composition')
    expect(doc.meta.target).toBe('standard')
    expect(doc.composition).toHaveLength(3)
    expect(doc.composition[0]).toMatchObject({
      id: 'standard:persona',
      entryId: 'persona',
      moduleName: '@deepseek-ai/dsh-persona',
      label: 'persona',
      enabled: true,
      fiberPhase: 'active',
      locked: true,
      layer: 'model-context',
      packageGroup: 'preset',
    })
    expect(doc.composition[1]).toMatchObject({
      layer: 'execution',
      packageGroup: 'fs',
      fiberPhase: null,
    })
    expect(doc.composition[2]?.fiberPhase).toBeUndefined()
    expect(doc.composition[2]?.entryId).toBeNull()
    expect(doc.composition[2]).toMatchObject({
      layer: 'execution',
      packageGroup: 'shell',
    })
    expect(unitIdForRow('standard', sample.rows[2]!, 2)).toBe('standard:row:2')
    expect(doc.composition[2]?.id).toBe('standard:row:2')
    expect(doc.catalog).toEqual([])
  })

  it('shortens nested mounted entry ids on the canvas label', () => {
    const doc = fromPresetComposition({
      ...sample,
      rows: [{
        entryId: 'delegation:tool-subagent',
        moduleName: '@deepseek-ai/dsh-tool-subagent',
        enabled: true,
      }],
    })
    expect(doc.composition[0]?.entryId).toBe('delegation:tool-subagent')
    expect(doc.composition[0]?.label).toBe('tool-subagent')
  })

  it('leaves user presets unlocked', () => {
    const doc = fromPresetComposition({ ...sample, trust: 'user', id: 'mine' })
    expect(doc.composition.every(unit => unit.locked === false)).toBe(true)
  })
})

describe('toGraphDocument', () => {
  const labels = {
    layerGroup: (layer: string) => `Layer:${layer}`,
    empty: 'Empty',
    broken: 'Broken',
  }

  it('projects composition units into architectural layer groups', () => {
    const doc = fromPresetComposition(sample)
    const graph = toGraphDocument(doc, labels)
    expect(graph.version).toBe(1)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.groups).toHaveLength(2)
    expect(graph.groups?.map(group => group.id)).toEqual([
      'layer:execution',
      'layer:model-context',
    ])
    expect(graph.groups?.[0]?.label).toBe('Layer:execution')
    expect(graph.groups?.[0]?.memberIds).toEqual(['standard:tool-fs', 'standard:row:2'])
    expect(graph.groups?.[1]?.memberIds).toEqual(['standard:persona'])
    expect(graph.nodes[0]?.groupId).toBe('layer:execution')
    expect(graph.nodes.find(node => node.id === 'standard:persona')?.data).toMatchObject({
      entryId: 'persona',
      moduleName: '@deepseek-ai/dsh-persona',
      fiberPhase: 'active',
      layer: 'model-context',
      packageGroup: 'preset',
      membership: 'composition',
      fill: '#1F1F23',
      stroke: '#3F3F46',
      meta: 'on',
    })
    expect(statusForEnablement(true)).toBe('done')
    expect(statusForEnablement(false)).toBe('idle')
    expect(statusForEnablement('conditional')).toBe('pending')
    expect(styleForEnablement(true).stroke).toBe('#3F3F46')
    expect(styleForEnablement(false).stroke).toBe('#27272A')
    expect(graph.nodes.find(node => node.id === 'standard:persona')?.status).toBe('done')
    expect(graph.nodes.find(node => node.id === 'standard:tool-fs')?.data).toMatchObject({
      fill: '#18181B',
      stroke: '#27272A',
      labelColor: '#52525B',
    })
    expect(graph.nodes.find(node => node.id === 'standard:tool-fs')?.status).toBe('idle')
    expect(graph.nodes.find(node => node.id === 'standard:row:2')?.status).toBe('pending')
  })

  it('stacks layer bands with foundation (lower wiki layers) at the bottom', () => {
    const doc = fromPresetComposition(sample)
    const graph = toGraphDocument(doc, labels)
    const modelY = graph.nodes.find(node => node.id === 'standard:persona')?.y ?? 0
    const execY = graph.nodes.find(node => node.id === 'standard:tool-fs')?.y ?? 0
    expect(modelY).toBeGreaterThan(execY)
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

  it('lays out catalog units in the same layer bands with host paint', () => {
    const doc = fromInventory(sample, [
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    const graph = toGraphDocument(doc, labels)
    const host = graph.nodes.find(node => node.id === 'host:host-ui')
    expect(host).toBeDefined()
    expect(host?.data).toMatchObject({ membership: 'catalog', meta: 'host' })
    expect(host?.data?.fill).not.toBe(styleForEnablement(true).fill)
  })

  it('draws Host-only bands when composition is empty but catalog is not', () => {
    const doc = fromInventory({ ...sample, rows: [] }, [
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    const graph = toGraphDocument(doc, labels)
    expect(graph.nodes.some(node => node.id === 'empty')).toBe(false)
    expect(graph.nodes.some(node => node.id === 'host:host-ui')).toBe(true)
  })

  it('layoutComposition assigns distinct grid positions', () => {
    const positions = layoutComposition(fromPresetComposition(sample).composition, 2)
    expect(positions['standard:persona']).toEqual({ x: 24, y: 28 })
    expect(positions['standard:tool-fs']).toEqual({ x: 204, y: 28 })
  })

  it('layoutByArchitecturalLayer preserves order within a layer', () => {
    const positions = layoutByArchitecturalLayer(fromPresetComposition(sample).composition, 2)
    expect(positions['standard:tool-fs']?.y).toBe(positions['standard:row:2']?.y)
    expect(positions['standard:tool-fs']?.x).toBeLessThan(positions['standard:row:2']?.x ?? 0)
  })

  it('uses a denser default column count for flat layout', () => {
    const many = fromPresetComposition({
      ...sample,
      rows: Array.from({ length: 5 }, (_, index) => ({
        entryId: `p${index}`,
        moduleName: '@deepseek-ai/dsh-persona',
        enabled: true as const,
      })),
    })
    const positions = layoutByArchitecturalLayer(many.composition)
    expect(positions['standard:p0']).toEqual({ x: 24, y: 28 })
    expect(positions['standard:p3']).toEqual({ x: 24 + 3 * (168 + 12), y: 28 })
    expect(positions['standard:p4']?.y).toBe(28 + 36 + 10)
  })
})
