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

  it('lays the root canvas out as a phase flow plus layer portals', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-c', atMs: 40 }),
      ],
    }))
    expect(document.nodes.filter(node => node.type === 'phase').map(node => node.id))
      .toEqual(['phase:compose', 'phase:mount'])
    // One colored portal per non-empty layer, each drilling into its subnet.
    const portals = document.nodes.filter(node => node.type === 'layer')
    expect(portals.map(node => node.label)).toEqual(['@example/base', '@example/app'])
    expect(portals.map(node => node.networkId)).toEqual(['network:layer:0', 'network:layer:1'])
    expect(portals.every(node => node.icon === 'router')).toBe(true)
    expect(portals.every(node => typeof node.data?.fill === 'string')).toBe(true)
    // Portals hang off the mount phase with low-alpha dashed edges.
    expect(document.edges.every(edge => edge.from === 'phase:compose' || edge.to !== undefined)).toBe(true)
    expect(document.edges.filter(edge => edge.from === 'phase:mount')).toHaveLength(2)
    // The compose phase keeps its application-order subnet.
    expect(document.nodes.find(node => node.id === 'phase:compose')?.networkId).toBe('network:compose')
    expect(Object.keys(document.networks ?? {}).sort()).toEqual([
      'network:compose',
      'network:layer:0',
      'network:layer:1',
    ])
  })

  it('keeps empty layers out of the portal roster', () => {
    const document = buildBootDocument(recording({
      layers: [
        { name: '@example/base', rowIds: ['entry-a'] },
        { name: '@example/empty', rowIds: ['entry-gone'] },
      ],
      events: [pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 })],
    }))
    expect(document.nodes.filter(node => node.type === 'layer').map(node => node.label))
      .toEqual(['@example/base'])
    // The composition view still shows every layer, including the empty one.
    const compose = document.networks?.['network:compose']
    expect(compose?.nodes.map(node => node.label)).toEqual(['@example/base', '@example/empty'])
  })

  it('routes each layer into its own subnetwork on a per-layer time axis', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12, inject: ['webStartup'] }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-b', atMs: 30 }),
        pluginEvent({ fiberUid: 3, entryId: 'entry-c', atMs: 60 }),
      ],
    }))
    const base = document.networks?.['network:layer:0']
    const app = document.networks?.['network:layer:1']
    expect(base?.nodes.map(node => node.id)).toEqual(['plugin:entry-a', 'plugin:entry-b'])
    expect(app?.nodes.map(node => node.id)).toEqual(['plugin:entry-c'])
    // x is the per-layer activation order; every node uses the plain icon.
    expect(base?.nodes.map(node => node.x)).toEqual([120, 300])
    expect(base?.nodes.every(node => node.icon === 'node')).toBe(true)
    expect(base?.nodes[0]?.data).toMatchObject({ layer: '@example/base', inject: ['webStartup'] })
    expect(app?.nodes[0]?.data?.layer).toBe('@example/app')
  })

  it('edges observed fiber parent-child relations and marks inactive rows cold', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-b', atMs: 40, parentEntryId: 'entry-a' }),
      ],
      inactiveEntryIds: ['entry-c'],
    }))
    const base = document.networks?.['network:layer:0']
    expect(base?.edges).toEqual([{
      id: 'edge:parent-2',
      from: 'plugin:entry-a',
      to: 'plugin:entry-b',
      kind: 'flow',
      style: { strokeDash: [6, 4], alpha: 0.35 },
    }])
    // Cross-layer parent relations have no endpoints in a single subnet; the
    // cold inactive row lives in its own layer's subnet after the activated rows.
    const app = document.networks?.['network:layer:1']
    const inactive = app?.nodes.find(node => node.id === 'plugin:entry-c')
    expect(inactive?.status).toBe('cold')
    expect(inactive?.x).toBe(120) // first slot of its layer (nothing activated there)
  })

  it('parks runtime-created entries in an unattributed subnetwork', () => {
    const document = buildBootDocument(recording({
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 9, entryId: 'include', entryName: 'cordis:include', atMs: 102 }),
      ],
    }))
    const portals = document.nodes.filter(node => node.type === 'layer')
    // The app layer placed nothing in this recording, so it earns no portal.
    expect(portals.map(node => node.label)).toEqual(['@example/base', '(unattributed)'])
    const portal = portals.find(node => node.label === '(unattributed)')
    const subnet = document.networks?.[portal?.networkId ?? '']
    expect(subnet?.nodes.map(node => node.id)).toEqual(['plugin:include'])
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
})
