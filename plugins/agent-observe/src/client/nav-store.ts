/**
 * Observe navigation store: fleet overview vs per-Agent process flow.
 *
 * Chat shortcut and Observe tab must share one instance per Session via this cache.
 */

import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Fleet overview or single-Agent process canvas. */
export type ObserveViewMode = 'fleet' | 'flow'

interface NavState {
  mode: ObserveViewMode
  focusTurn: number | null
}

type NavActions = {
  showFleet: (draft: NavState) => void
  showFlow: (draft: NavState, turn?: number) => void
  showLatest: (draft: NavState) => void
}

/**
 * Create the Observe navigation store handle (one per plugin apply).
 * @returns store handle for the conversation.view registration.
 */
export function createObserveNavStore(): EngineStoreHandle<NavState, NavActions> {
  const inner = defineStore({
    init: (): NavState => ({ mode: 'fleet', focusTurn: null }),
    actions: {
      showFleet: (state) => {
        state.mode = 'fleet'
        state.focusTurn = null
      },
      showFlow: (state, turn?: number) => {
        state.mode = 'flow'
        state.focusTurn = turn === undefined ? null : turn
      },
      showLatest: (state) => {
        state.mode = 'flow'
        state.focusTurn = null
      },
    },
  })
  const cache = new Map<string, ReturnType<typeof inner.create>>()
  return {
    spec: inner.spec,
    create(scopeKey?: string) {
      const key = scopeKey ?? ''
      let instance = cache.get(key)
      if (instance === undefined) {
        instance = inner.create(scopeKey)
        cache.set(key, instance)
      }
      return instance
    },
  }
}
