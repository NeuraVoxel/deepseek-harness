import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/parse.ts'

describe('parseDocument', () => {
  it('parses a minimal valid document', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A' }],
      edges: [],
    })
    expect(doc.nodes).toHaveLength(1)
    expect(doc.nodes[0]?.id).toBe('a')
  })

  it('rejects missing node id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ type: 'agent', label: 'A' }],
      edges: [],
    })).toThrow(/parse failed/)
  })

  it('rejects unknown version', () => {
    expect(() => parseDocument({
      version: 2,
      nodes: [],
      edges: [],
    })).toThrow(/parse failed/)
  })
})
