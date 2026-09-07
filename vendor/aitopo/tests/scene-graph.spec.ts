import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'

describe('GraphScene', () => {
  it('loads indexes and applies patches', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 0, y: 0 }],
      edges: [{ id: 'e1', from: 'a', to: 'a' }],
    })
    expect(scene.nodes.size).toBe(1)
    const version = scene.version
    scene.apply({
      ops: [{ op: 'addNode', node: { id: 'b', type: 'agent', label: 'B' } }],
    })
    expect(scene.nodes.size).toBe(2)
    expect(scene.version).toBeGreaterThan(version)
  })

  it('does not change version when apply throws', () => {
    const scene = new GraphScene()
    scene.load({ version: 1, nodes: [], edges: [] })
    const version = scene.version
    expect(() => scene.apply({
      ops: [{ op: 'removeNode', id: 'missing' }],
    })).toThrow()
    expect(scene.version).toBe(version)
  })

  it('enters and exits a subnetwork', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{ id: 'root-n', type: 'team', label: 'Team', networkId: 'team-a' }],
      edges: [],
      networks: {
        'team-a': {
          version: 1,
          nodes: [{ id: 'm1', type: 'agent', label: 'Member' }],
          edges: [],
        },
      },
    })
    scene.enterSubNetwork('team-a')
    expect(scene.currentNetworkId).toBe('team-a')
    expect(scene.nodes.has('m1')).toBe(true)
    scene.exitSubNetwork()
    expect(scene.currentNetworkId).toBeNull()
    expect(scene.nodes.has('root-n')).toBe(true)
  })

  it('rejects missing subnetwork', () => {
    const scene = new GraphScene()
    scene.load({ version: 1, nodes: [], edges: [] })
    expect(() => scene.enterSubNetwork('nope')).toThrow(/missing network/)
  })
})
