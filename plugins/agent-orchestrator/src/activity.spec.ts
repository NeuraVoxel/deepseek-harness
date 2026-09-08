import { describe, expect, it } from 'vitest'
import { deriveCompositionActivity } from './client/derive-activity.ts'
import { fromInventory } from './from-inventory.ts'
import { fromPresetComposition } from './from-preset.ts'
import {
  liveUnitIds,
  normalizeToolToken,
  unitIdsForToolName,
  withLiveActivity,
  LIVE_RUNNING_STYLE,
  LIVE_TURN_STYLE,
} from './map-tool-activity.ts'
import { toGraphDocument } from './to-graph.ts'
import type { PresetCompositionInput } from './types.ts'

const sample: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  name: 'Standard',
  isDefault: true,
  rows: [
    { entryId: 'tool-bash', moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true },
    { entryId: 'tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: true },
    { entryId: 'delegation:tool-subagent', moduleName: '@deepseek-ai/dsh-tool-subagent', enabled: true },
  ],
}

describe('normalizeToolToken', () => {
  it('lowercases and maps underscores to hyphens', () => {
    expect(normalizeToolToken('read_image')).toBe('read-image')
  })
})

describe('unitIdsForToolName', () => {
  const units = fromPresetComposition(sample).composition

  it('maps common tool names onto composition units', () => {
    expect(unitIdsForToolName(units, 'bash')).toEqual(['standard:tool-bash'])
    expect(unitIdsForToolName(units, 'read')).toEqual(['standard:tool-fs'])
    expect(unitIdsForToolName(units, 'subagent')).toEqual(['standard:delegation:tool-subagent'])
  })
})

describe('live highlight composition-only', () => {
  it('does not map tools onto catalog-only host units', () => {
    const doc = fromInventory(sample, [
      { entryId: 'tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: true, fiberPhase: 'active' },
      { entryId: 'extra-fs', moduleName: '@deepseek-ai/dsh-tool-fs-search', enabled: true, fiberPhase: 'active' },
    ])
    // tool-fs overlaps composition → catalog empty for that entry; extra-fs is catalog-only.
    expect(doc.catalog.some(unit => unit.id === 'host:extra-fs')).toBe(true)
    // force a catalog unit whose label would match "glob" if scanned
    const catalogHits = liveUnitIds(doc.catalog, ['glob'])
    expect(catalogHits.has('host:extra-fs')).toBe(true)
    // production path must pass composition only — assert OrchestratorView / helper contract:
    expect(liveUnitIds(doc.composition, ['read']).has('host:tool-fs')).toBe(false)
    expect(liveUnitIds(doc.composition, ['glob']).has('host:extra-fs')).toBe(false)
  })
})

describe('withLiveActivity', () => {
  const labels = {
    layerGroup: (layer: string) => layer,
    empty: 'Empty',
    broken: 'Broken',
  }

  it('paints running and turn nodes distinctly', () => {
    const doc = fromPresetComposition(sample)
    const graph = toGraphDocument(doc, labels)
    const runningIds = liveUnitIds(doc.composition, ['bash'])
    const turnIds = liveUnitIds(doc.composition, ['bash', 'read'])
    const live = withLiveActivity(graph, runningIds, turnIds)
    const bash = live.nodes.find(node => node.id === 'standard:tool-bash')
    const fs = live.nodes.find(node => node.id === 'standard:tool-fs')
    expect(bash?.status).toBe('running')
    expect(bash?.data).toMatchObject({ ...LIVE_RUNNING_STYLE, live: true, meta: 'running' })
    expect(fs?.data).toMatchObject({ ...LIVE_TURN_STYLE, live: true, meta: 'this turn' })
  })
})

describe('deriveCompositionActivity', () => {
  it('keeps finished tools on turnToolNames while the session is running', () => {
    const events = {
      entries: [
        {
          type: 'event',
          event: { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } },
        },
        {
          type: 'event',
          event: {
            type: 'tool/call',
            seq: 2,
            time: 2,
            data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' },
          },
        },
        {
          type: 'event',
          event: {
            type: 'tool/call',
            seq: 3,
            time: 3,
            data: { turn: 1, step: 1, callId: 'c2', name: 'read', arguments: '{}' },
          },
        },
        {
          type: 'event',
          event: {
            type: 'tool/result',
            seq: 4,
            time: 4,
            data: {
              turn: 1,
              step: 1,
              message: {
                source: { type: 'tool-result', callId: 'c1' },
                content: [{ type: 'tool-result', toolCallId: 'c1', content: [], isError: false }],
                isError: false,
              },
            },
          },
        },
      ],
      hasMore: false,
    } as never
    const running = deriveCompositionActivity(events, { running: true } as never, 'standard')
    expect(running.runningToolNames).toEqual(['read'])
    expect([...running.turnToolNames].sort()).toEqual(['bash', 'read'])
    expect(running.sessionPresetId).toBe('standard')
    const idle = deriveCompositionActivity(events, { running: false } as never, null)
    expect(idle.runningToolNames).toEqual([])
    expect(idle.turnToolNames).toEqual([])
  })

  it('does not inherit prior-turn tools when the latest turn has none', () => {
    const events = {
      entries: [
        {
          type: 'event',
          event: { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } },
        },
        {
          type: 'event',
          event: {
            type: 'tool/call',
            seq: 2,
            time: 2,
            data: { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' },
          },
        },
        {
          type: 'event',
          event: {
            type: 'tool/result',
            seq: 3,
            time: 3,
            data: {
              turn: 1,
              step: 1,
              message: {
                source: { type: 'tool-result', callId: 'c1' },
                content: [{ type: 'tool-result', toolCallId: 'c1', content: [], isError: false }],
                isError: false,
              },
            },
          },
        },
        {
          type: 'event',
          event: { type: 'turn/end', seq: 4, time: 4, data: { turn: 1 } },
        },
        {
          type: 'event',
          event: { type: 'turn/start', seq: 5, time: 5, data: { turn: 2 } },
        },
      ],
      hasMore: false,
    } as never
    const activity = deriveCompositionActivity(events, { running: true } as never, 'standard')
    expect(activity.runningToolNames).toEqual([])
    expect(activity.turnToolNames).toEqual([])
  })
})
