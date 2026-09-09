import { describe, expect, it } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { GraphEvent } from '../src/protocol/events.ts'

describe('Network editor helpers', () => {
  function createNetwork(): Network {
    const network = new Network({ defaultInteractions: false })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 10, y: 20, groupId: 'g1' },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 20 },
      ],
      edges: [],
      groups: [
        {
          id: 'g1',
          label: 'G1',
          memberIds: ['a'],
          x: 0,
          y: 0,
          w: 120,
          h: 80,
          style: { strokeDash: [4, 2] },
        },
        { id: 'g2', label: 'G2', memberIds: [], x: 180, y: 0, w: 120, h: 80 },
      ],
    })
    return network
  }

  it('previews position without nodeMoved or documentChanged', () => {
    const network = createNetwork()
    const events: GraphEvent[] = []
    network.on(event => events.push(event))
    network.previewNodePosition('a', 40, 50)
    expect(network.getNode('a')).toMatchObject({ x: 40, y: 50 })
    expect(events).toEqual([])
  })

  it('commits move and membership change', () => {
    const network = createNetwork()
    const events: GraphEvent[] = []
    network.on(event => events.push(event))
    network.commitNodeMove({
      nodeId: 'a',
      from: { x: 10, y: 20 },
      to: { x: 190, y: 30 },
      toGroupId: 'g2',
    })
    expect(network.getNode('a')).toMatchObject({ x: 190, y: 30, groupId: 'g2' })
    expect(network.getGroups().find(g => g.id === 'g1')?.memberIds).toEqual([])
    expect(network.getGroups().find(g => g.id === 'g2')?.memberIds).toEqual(['a'])
    expect(network.getGroups().find(g => g.id === 'g1')?.style?.strokeDash).toEqual([4, 2])
    expect(events.filter(e => e.type === 'nodeMoved')).toEqual([{
      type: 'nodeMoved',
      nodeId: 'a',
      from: { x: 10, y: 20 },
      to: { x: 190, y: 30 },
    }])
    expect(events.filter(e => e.type === 'groupMembershipChanged')).toEqual([{
      type: 'groupMembershipChanged',
      nodeId: 'a',
      fromGroupId: 'g1',
      toGroupId: 'g2',
    }])
  })

  it('clears membership when toGroupId is undefined', () => {
    const network = createNetwork()
    const events: GraphEvent[] = []
    network.on(event => events.push(event))
    network.commitNodeMove({
      nodeId: 'a',
      from: { x: 10, y: 20 },
      to: { x: 10, y: 20 },
      toGroupId: undefined,
    })
    expect(network.getNode('a')?.groupId).toBeUndefined()
    expect(network.getGroups().find(g => g.id === 'g1')?.memberIds).toEqual([])
    expect(events.filter(e => e.type === 'groupMembershipChanged')).toEqual([{
      type: 'groupMembershipChanged',
      nodeId: 'a',
      fromGroupId: 'g1',
      toGroupId: undefined,
    }])
  })

  it('preserves membership when toGroupId key is omitted', () => {
    const network = createNetwork()
    const events: GraphEvent[] = []
    network.on(event => events.push(event))
    network.commitNodeMove({
      nodeId: 'a',
      from: { x: 10, y: 20 },
      to: { x: 55, y: 60 },
    })
    expect(network.getNode('a')).toMatchObject({ x: 55, y: 60, groupId: 'g1' })
    expect(network.getGroups().find(g => g.id === 'g1')?.memberIds).toEqual(['a'])
    expect(events.filter(e => e.type === 'nodeMoved')).toEqual([{
      type: 'nodeMoved',
      nodeId: 'a',
      from: { x: 10, y: 20 },
      to: { x: 55, y: 60 },
    }])
    expect(events.filter(e => e.type === 'groupMembershipChanged')).toEqual([])
  })

  it('hit-tests groups in screen space', () => {
    const network = createNetwork()
    network.viewport.setViewSize({ width: 400, height: 300 })
    network.viewport.setCamera({ x: 0, y: 0, zoom: 1 })
    expect(network.hitTestGroupScreen(20, 20)).toBe('g1')
    expect(network.hitTestGroupScreen(200, 20)).toBe('g2')
    expect(network.hitTestGroupScreen(400, 400)).toBeUndefined()
  })

  it('tracks gesture drag flag', () => {
    const network = createNetwork()
    expect(network.wasGestureDragged()).toBe(false)
    network.markGestureDragged()
    expect(network.wasGestureDragged()).toBe(true)
    network.clearGestureDragged()
    expect(network.wasGestureDragged()).toBe(false)
  })

  it('commitEdgeCreate adds edge and emits edgeCreated', () => {
    const network = createNetwork()
    const events: GraphEvent[] = []
    network.on(event => events.push(event))
    const id = network.commitEdgeCreate({ from: 'a', to: 'b', kind: 'data', id: 'e-ab' })
    expect(id).toBe('e-ab')
    expect(network.getEdges()).toEqual([
      expect.objectContaining({ id: 'e-ab', from: 'a', to: 'b', kind: 'data' }),
    ])
    expect(events.filter(e => e.type === 'edgeCreated')).toEqual([{
      type: 'edgeCreated',
      edgeId: 'e-ab',
      from: 'a',
      to: 'b',
      kind: 'data',
    }])
  })

  it('commitEdgeCreate skips duplicates and self-links', () => {
    const network = createNetwork()
    expect(network.commitEdgeCreate({ from: 'a', to: 'a' })).toBeUndefined()
    network.commitEdgeCreate({ from: 'a', to: 'b', id: 'e1' })
    expect(network.commitEdgeCreate({ from: 'a', to: 'b' })).toBeUndefined()
    expect(network.getEdges()).toHaveLength(1)
  })

  it('commitEdgeRemove emits edgeRemoved', () => {
    const network = createNetwork()
    network.commitEdgeCreate({ from: 'a', to: 'b', id: 'e1' })
    const events: GraphEvent[] = []
    network.on(event => events.push(event))
    network.commitEdgeRemove(['e1', 'missing'])
    expect(network.getEdges()).toEqual([])
    expect(events.filter(e => e.type === 'edgeRemoved')).toEqual([
      { type: 'edgeRemoved', edgeId: 'e1' },
    ])
  })
})
