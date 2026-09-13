import { describe, expect, it } from 'vitest'

import { parseDocument } from '@neuravoxel/aitopo'

import { buildBootDocument, type BootPluginEvent, type BootRecording } from './observe-boot-document.ts'

function pluginEvent(overrides: Partial<BootPluginEvent>): BootPluginEvent {
  return {
    atMs: 0,
    kind: 'construction',
    fiberUid: 1,
    entryId: 'entry-a',
    entryName: '@example/plugin-a',
    inject: [],
    disabled: false,
    ...overrides,
  }
}

function recording(overrides: Partial<BootRecording> = {}): BootRecording {
  return {
    binName: 'dsh',
    profile: 'web',
    recordedAt: '2026-09-13T00:00:00.000Z',
    phases: [
      { id: 'compose', label: 'Compose profile', startedAtMs: 0, endedAtMs: 10, detail: 'layers' },
      { id: 'mount', label: 'Mount plugin tree', startedAtMs: 10, endedAtMs: 210, detail: '2 fibers' },
    ],
    events: [],
    layers: [
      { name: '@example/base', rowIds: ['entry-a', 'entry-b'] },
      { name: '@example/app', rowIds: ['entry-c'] },
    ],
    inactiveEntryIds: [],
    ...overrides,
  }
}

describe('buildBootDocument', () => {
  it('produces a parseDocument-valid document', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', entryName: '@example/plugin-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-c', entryName: '@example/plugin-c', atMs: 40, parentEntryId: 'entry-a' }),
      ],
    }))
    // parseDocument applies field defaults, so compare identity, not depth.
    const parsed = parseDocument(document)
    expect(parsed.nodes.map(node => node.id)).toEqual(document.nodes.map(node => node.id))
    expect(Object.keys(parsed.networks ?? {})).toEqual(Object.keys(document.networks ?? {}))
  })

  it('lays the root canvas out as a phase flow with sub-network drill-downs', () => {
    const document = buildBootDocument(recording())
    expect(document.nodes.map(node => node.id)).toEqual(['phase:compose', 'phase:mount'])
    expect(document.edges).toEqual([
      { id: 'edge:compose-mount', from: 'phase:compose', to: 'phase:mount', kind: 'flow' },
    ])
    const mount = document.nodes.find(node => node.id === 'phase:mount')
    expect(mount?.networkId).toBe('network:mount')
    expect(Object.keys(document.networks ?? {}).sort()).toEqual(['network:compose', 'network:mount'])
  })

  it('bands construction events into per-layer groups on a time axis', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-b', atMs: 30, inject: ['webStartup'] }),
        pluginEvent({ fiberUid: 3, entryId: 'entry-c', atMs: 60 }),
      ],
    }))
    const mount = document.networks?.['network:mount']
    expect(mount).toBeDefined()
    const pluginNodes = mount?.nodes ?? []
    expect(pluginNodes.map(node => node.type)).toEqual(['plugin', 'plugin', 'plugin'])
    // x follows the real activation order across lanes.
    expect(pluginNodes.map(node => node.x)).toEqual([120, 300, 480])
    // y is the layer lane: entry-a/entry-b share base (lane 0), entry-c in app (lane 1).
    expect(pluginNodes.map(node => node.y)).toEqual([100, 100, 250])
    const groups = mount?.groups ?? []
    expect(groups.map(group => group.label)).toEqual(['@example/base', '@example/app'])
    expect(groups[0]?.memberIds).toEqual(['plugin:entry-a', 'plugin:entry-b'])
    expect(groups[1]?.memberIds).toEqual(['plugin:entry-c'])
  })

  it('edges observed fiber parent-child relations and marks inactive rows cold', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-c', atMs: 40, parentEntryId: 'entry-a' }),
      ],
      inactiveEntryIds: ['entry-b'],
    }))
    const mount = document.networks?.['network:mount']
    expect(mount?.edges).toContainEqual({
      id: 'edge:parent-2',
      from: 'plugin:entry-a',
      to: 'plugin:entry-c',
      kind: 'flow',
      label: 'parent',
    })
    const inactive = mount?.nodes.find(node => node.id === 'plugin:entry-b')
    expect(inactive?.status).toBe('cold')
    // Inactive members still join their layer's group band.
    const baseGroup = mount?.groups?.find(group => group.label === '@example/base')
    expect(baseGroup?.memberIds).toContain('plugin:entry-b')
  })
})
