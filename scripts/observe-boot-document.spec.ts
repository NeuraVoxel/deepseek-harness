import { describe, expect, it } from 'vitest'

import { parseDocument } from '@neuravoxel/aitopo'

import { buildBootDocument, UNATTRIBUTED_LAYER, type BootPluginEvent, type BootRecording } from './observe-boot-document.ts'

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
    // The label names the bucket plainly: runtime mounts with no yml row.
    expect(portals.map(node => node.label)).toEqual([
      '@example/base',
      'runtime-mounted（动态挂载，无 yml 声明）',
    ])
    const portal = portals.find(node => node.label === UNATTRIBUTED_LAYER)
    const subnet = document.networks?.[portal?.networkId ?? '']
    expect(subnet?.nodes.map(node => node.id)).toEqual(['plugin:include'])
  })

  it('rows portals under the mount phase: internal first, then external', () => {
    const document = buildBootDocument(recording({
      layers: [
        { name: '@deepseek-ai/dsh-base', rowIds: ['entry-a'] },
        { name: 'dshmarket', rowIds: ['entry-d'] },
        { name: '@deepseek-ai/dsh-web-app', rowIds: ['entry-c'] },
        { name: 'dsh-context', rowIds: ['entry-e'] },
      ],
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-d', atMs: 40 }),
        pluginEvent({ fiberUid: 3, entryId: 'entry-c', atMs: 60 }),
        pluginEvent({ fiberUid: 4, entryId: 'entry-e', atMs: 80 }),
      ],
    }))
    const byLabel = new Map(
      document.nodes.filter(node => node.type === 'layer').map(node => [node.label, node]),
    )
    const base = byLabel.get('@deepseek-ai/dsh-base')
    const webApp = byLabel.get('@deepseek-ai/dsh-web-app')
    const market = byLabel.get('dshmarket')
    const context = byLabel.get('dsh-context')
    // Row 0 (internal, 2 items) centers on the mount node's x (fixture has
    // two phases → mount at index 1 → x=380).
    expect(base?.x).toBe(230)
    expect(webApp?.x).toBe(530)
    expect(base?.y).toBe(320)
    expect(webApp?.y).toBe(320)
    // External rows follow below, ≤3 per row, re-centered per row.
    expect(market?.x).toBe(230)
    expect(market?.y).toBe(480)
    expect(context?.x).toBe(530)
    expect(context?.y).toBe(480)
    // Origin colors stay.
    expect(base?.data?.fill).toBe('#3d6f9e')
    expect(market?.data?.fill).toBe('#d97b2f')
  })

  it('attributes a restated row id to its LAST declaring layer only', () => {
    // Patch semantics: a later layer restating an id overrides it, so the
    // constructed plugin must appear in that layer's subnet — and nowhere else.
    const document = buildBootDocument(recording({
      layers: [
        { name: '@example/base', rowIds: ['entry-a', 'entry-b'] },
        { name: '@example/app', rowIds: ['entry-b'] },
      ],
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-b', atMs: 40 }),
      ],
    }))
    const base = document.networks?.['network:layer:0']
    const app = document.networks?.['network:layer:1']
    expect(base?.nodes.map(node => node.id)).toEqual(['plugin:entry-a'])
    expect(app?.nodes.map(node => node.id)).toEqual(['plugin:entry-b'])
    // Portal counts equal their subnet contents.
    const portalById = new Map(
      document.nodes.filter(node => node.type === 'layer').map(node => [node.networkId, node]),
    )
    expect(portalById.get('network:layer:0')?.label2).toBe('1 plugins')
    expect(portalById.get('network:layer:1')?.label2).toBe('1 plugins')
  })

  it('collapses restart re-mounts into one node per plugin', () => {
    // A config reload re-creates fibers: three construction events for the
    // same entry id must render one node (the engine dedupes node ids).
    const document = buildBootDocument(recording({
      layers: [{ name: '@example/base', rowIds: ['entry-a'] }],
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-a', atMs: 40 }),
        pluginEvent({ fiberUid: 3, entryId: 'entry-a', atMs: 90 }),
      ],
    }))
    const subnet = document.networks?.['network:layer:0']
    expect(subnet?.nodes).toHaveLength(1)
    expect(subnet?.nodes[0]?.data?.atMs).toBe(90)
    const portal = document.nodes.find(node => node.type === 'layer')
    expect(portal?.label2).toBe('1 plugins')
  })

  it('wraps plugin nodes to a new row every six columns', () => {
    const events = Array.from({ length: 7 }, (_, index) =>
      pluginEvent({ fiberUid: index + 1, entryId: `entry-${index}`, atMs: 10 + index * 5 }))
    const document = buildBootDocument(recording({
      layers: [{ name: '@example/base', rowIds: events.map(event => event.entryId) }],
      events,
    }))
    const base = document.networks?.['network:layer:0']
    // Slots 0-5 fill row 0; slot 6 wraps to x of column 0 on row 1.
    expect(base?.nodes.slice(0, 6).map(node => node.y)).toEqual(Array.from({ length: 6 }, () => 100))
    const seventh = base?.nodes[6]
    expect(seventh?.x).toBe(120)
    expect(seventh?.y).toBe(200)
  })

  it('strips the @deepseek-ai scope from plugin display names, keeping other scopes', () => {
    const document = buildBootDocument(recording({
      layers: [{ name: '@deepseek-ai/dsh-base', rowIds: ['entry-a', 'entry-b', 'entry-c'] }],
      events: [
        pluginEvent({ fiberUid: 1, entryId: 'entry-a', entryName: '@deepseek-ai/dsh-client-ui-layout', atMs: 12 }),
        pluginEvent({ fiberUid: 2, entryId: 'entry-b', entryName: 'dsh-cost-meter', atMs: 30 }),
        pluginEvent({ fiberUid: 3, entryId: 'entry-c', entryName: '@linxin666/dsh-client-ui-skill-explorer', atMs: 60 }),
      ],
    }))
    const base = document.networks?.['network:layer:0']
    expect(base?.nodes.map(node => node.label)).toEqual([
      'dsh-client-ui-layout',
      'dsh-cost-meter',
      '@linxin666/dsh-client-ui-skill-explorer',
    ])
    // The layer data keeps the full portal name; plugin nodes carry no label2 —
    // that second label is reserved for SubNetwork portals.
    expect(base?.nodes[0]?.data?.layer).toBe('@deepseek-ai/dsh-base')
    expect(base?.nodes.every(node => node.label2 === undefined)).toBe(true)
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
