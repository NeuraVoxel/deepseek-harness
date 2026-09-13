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
      {
        id: 'edge:compose-mount',
        from: 'phase:compose',
        to: 'phase:mount',
        kind: 'flow',
        style: { strokeDash: [6, 4] },
      },
    ])
    const mount = document.nodes.find(node => node.id === 'phase:mount')
    expect(mount?.networkId).toBe('network:mount')
    // Drillable phases carry the router icon; plain phases stay 'node'.
    expect(mount?.icon).toBe('router')
    expect(document.nodes.find(node => node.id === 'phase:compose')?.icon).toBe('router')
    expect(Object.keys(document.networks ?? {}).sort()).toEqual(['network:compose', 'network:mount'])
  })

  it('styles plugin nodes with the plain node icon and layer nodes as servers', () => {
    const document = buildBootDocument(recording({
      events: [pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 })],
    }))
    expect(document.networks?.['network:mount']?.nodes.every(node => node.icon === 'node')).toBe(true)
    expect(document.networks?.['network:compose']?.nodes.every(node => node.icon === 'server')).toBe(true)
    expect(document.networks?.['network:compose']?.edges.every(edge => edge.style?.strokeDash !== undefined)).toBe(true)
  })

  it('recolors phase nodes by their duration bucket', () => {
    const document = buildBootDocument(recording({
      phases: [
        { id: 'compose', label: 'Compose', startedAtMs: 0, endedAtMs: 5, detail: '' },
        { id: 'mount', label: 'Mount', startedAtMs: 5, endedAtMs: 805, detail: '' },
        { id: 'settle', label: 'Settle', startedAtMs: 805, endedAtMs: 3_805, detail: '' },
        { id: 'ready', label: 'Ready', startedAtMs: 3_805, endedAtMs: 8_805, detail: '' },
      ],
    }))
    const byId = new Map(document.nodes.map(node => [node.id, node]))
    expect(byId.get('phase:compose')?.data).toMatchObject({ durationBucket: 'fast', fill: '#2e7d32' })
    expect(byId.get('phase:mount')?.data).toMatchObject({ durationBucket: 'moderate', fill: '#9a6b00' })
    expect(byId.get('phase:settle')?.data).toMatchObject({ durationBucket: 'slow', fill: '#d84315' })
    expect(byId.get('phase:ready')?.data).toMatchObject({ durationBucket: 'critical', fill: '#b71c1c' })
    // Every phase carries both paint overrides.
    expect(document.nodes.every(node => typeof node.data?.fill === 'string' && typeof node.data?.stroke === 'string'))
      .toBe(true)
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
    // x is the per-layer activation order (each layer's row starts at x=120).
    expect(pluginNodes.map(node => node.x)).toEqual([120, 300, 120])
    // y is the layer block: base holds two rows-worth of one row (baseY 100);
    // app's block starts one row + gap lower (100 + 100 + 60).
    expect(pluginNodes.map(node => node.y)).toEqual([100, 100, 260])
    const groups = mount?.groups ?? []
    expect(groups.map(group => group.label)).toEqual(['@example/base', '@example/app'])
    expect(groups[0]?.memberIds).toEqual(['plugin:entry-a', 'plugin:entry-b'])
    expect(groups[1]?.memberIds).toEqual(['plugin:entry-c'])
    // Nodes carry the groupId arm of the membership encoding.
    expect(pluginNodes.map(node => node.groupId)).toEqual([
      'group:example-base',
      'group:example-base',
      'group:example-app',
    ])
    // Bands default collapsed, sized to their member bbox, and hue-coded.
    expect(groups.every(group => group.expanded !== true)).toBe(true)
    expect(groups.every(group => group.x !== undefined && group.w !== undefined && group.h !== undefined)).toBe(true)
    expect(groups[0]?.style?.fill).not.toBe(groups[1]?.style?.fill)
    expect(groups[0]?.style?.stroke).toBeDefined()
    // Bands grow around members when expanded: no autoFit opt-out.
    expect(groups.every(group => group.style?.autoFit !== false)).toBe(true)
  })

  it('omits bands for layers with no placed plugins', () => {
    const document = buildBootDocument(recording({
      layers: [
        { name: '@example/base', rowIds: ['entry-a'] },
        { name: '@example/empty', rowIds: ['entry-gone'] },
      ],
      events: [pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 })],
      inactiveEntryIds: [],
    }))
    const mount = document.networks?.['network:mount']
    expect(mount?.groups?.map(group => group.label)).toEqual(['@example/base'])
    // The composition view still shows every layer, including the empty one.
    const compose = document.networks?.['network:compose']
    expect(compose?.nodes.map(node => node.label)).toEqual(['@example/base', '@example/empty'])
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
      style: { strokeDash: [6, 4] },
    })
    const inactive = mount?.nodes.find(node => node.id === 'plugin:entry-b')
    expect(inactive?.status).toBe('cold')
    // Inactive members still join their layer's group band.
    const baseGroup = mount?.groups?.find(group => group.label === '@example/base')
    expect(baseGroup?.memberIds).toContain('plugin:entry-b')
  })
})
