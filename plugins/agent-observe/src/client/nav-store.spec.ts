import { describe, expect, it } from 'vitest'
import { createObserveNavStore } from './nav-store.ts'

describe('createObserveNavStore', () => {
  it('dedupes create(scopeKey) so two callers share one instance', () => {
    const handle = createObserveNavStore()
    const a = handle.create('s1')
    const b = handle.create('s1')
    expect(a).toBe(b)
    a.actions.showFlow(3)
    expect(b.getSnapshot()).toEqual({ mode: 'flow', focusTurn: 3, dimension: 'process' })
  })

  it('showFlow without turn clears the pin; showLatest clears pin and stays in flow; showFleet clears pin', () => {
    const nav = createObserveNavStore().create('s1')
    nav.actions.showFlow(2)
    nav.actions.showFlow()
    expect(nav.getSnapshot()).toEqual({ mode: 'flow', focusTurn: null, dimension: 'process' })
    nav.actions.showFlow(4)
    nav.actions.showLatest()
    expect(nav.getSnapshot()).toEqual({ mode: 'flow', focusTurn: null, dimension: 'process' })
    nav.actions.showFlow(1)
    nav.actions.showFleet()
    expect(nav.getSnapshot()).toEqual({ mode: 'fleet', focusTurn: null, dimension: 'process' })
  })

  it('setDimension remembers the Flow tab without clearing the Turn pin', () => {
    const nav = createObserveNavStore().create('s1')
    nav.actions.showFlow(2)
    nav.actions.setDimension('events')
    expect(nav.getSnapshot()).toEqual({ mode: 'flow', focusTurn: 2, dimension: 'events' })
    nav.actions.setDimension('bogus' as import('./flow-dimensions/types.ts').FlowDimensionId)
    expect(nav.getSnapshot().dimension).toBe('process')
  })
})
