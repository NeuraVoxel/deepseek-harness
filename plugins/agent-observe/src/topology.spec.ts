/**
 * Host topology Turn-count helpers.
 */

import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { turnCountFromSession } from './topology.ts'

const sid = (value: string): SessionId => value as SessionId

describe('turnCountFromSession', () => {
  it('returns the max turn/start number from the Session log', () => {
    expect(turnCountFromSession({
      id: sid('s1'),
      seq: 3,
      header: {},
      snapshotEvents: () => [
        { type: 'turn/start', data: { turn: 1 } },
        { type: 'step/end' },
        { type: 'turn/start', data: { turn: 3 } },
      ],
    })).toBe(3)
  })

  it('returns 0 when the log has no turn/start yet', () => {
    expect(turnCountFromSession({
      id: sid('blank'),
      seq: 0,
      header: {},
      snapshotEvents: () => [],
    })).toBe(0)
  })

  it('returns undefined when snapshotEvents is unavailable', () => {
    expect(turnCountFromSession({
      id: sid('row'),
      seq: 1,
      header: {},
    })).toBeUndefined()
  })
})
