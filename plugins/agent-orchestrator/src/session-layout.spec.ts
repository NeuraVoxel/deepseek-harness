import { describe, expect, it } from 'vitest'
import { applyNodeMovedToLayout, withSessionLayout } from './session-layout.ts'
import type { OrchestrationDocument } from './types.ts'
import { ORCHESTRATION_DOCUMENT_VERSION } from './types.ts'

const emptyDoc = {
  version: ORCHESTRATION_DOCUMENT_VERSION,
  meta: { kind: 'agent-preset-composition' as const, target: 'x' },
  catalog: [],
  composition: [],
  constraints: [],
} satisfies OrchestrationDocument

describe('session-layout', () => {
  it('applyNodeMovedToLayout merges a position into an empty layout', () => {
    expect(applyNodeMovedToLayout(undefined, 'a', { x: 10, y: 20 })).toEqual({
      positions: { a: { x: 10, y: 20 } },
    })
  })

  it('applyNodeMovedToLayout preserves sibling positions', () => {
    const next = applyNodeMovedToLayout(
      { positions: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } } },
      'a',
      { x: 9, y: 8 },
    )
    expect(next.positions).toEqual({
      a: { x: 9, y: 8 },
      b: { x: 3, y: 4 },
    })
  })

  it('withSessionLayout returns the same reference when layout is empty', () => {
    expect(withSessionLayout(emptyDoc, undefined)).toBe(emptyDoc)
    expect(withSessionLayout(emptyDoc, { positions: {} })).toBe(emptyDoc)
  })

  it('withSessionLayout overlays session positions onto document layout', () => {
    const base: OrchestrationDocument = {
      ...emptyDoc,
      layout: { positions: { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } } },
    }
    const merged = withSessionLayout(base, { positions: { a: { x: 5, y: 5 } } })
    expect(merged.layout?.positions).toEqual({
      a: { x: 5, y: 5 },
      b: { x: 2, y: 2 },
    })
  })
})
