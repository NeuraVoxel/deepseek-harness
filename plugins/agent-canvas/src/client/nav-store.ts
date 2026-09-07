/**
 * Canvas navigation store: fleet overview vs per-Agent process flow.
 */

import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Fleet overview or single-Agent process canvas. */
export type CanvasViewMode = 'fleet' | 'flow'

interface NavState {
  mode: CanvasViewMode
}

type NavActions = {
  showFleet: (draft: NavState) => void
  showFlow: (draft: NavState) => void
}

/**
 * Create the Canvas navigation store handle (one per plugin apply).
 * @returns store handle for the conversation.view registration.
 */
export function createCanvasNavStore(): EngineStoreHandle<NavState, NavActions> {
  return defineStore({
    init: (): NavState => ({ mode: 'fleet' }),
    actions: {
      showFleet: (state) => { state.mode = 'fleet' },
      showFlow: (state) => { state.mode = 'flow' },
    },
  })
}
