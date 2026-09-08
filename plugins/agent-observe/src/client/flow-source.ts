/**
 * Observable Agent flow snapshot bound to one Session's event window.
 */

import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot, StoreInstance } from '@deepseek-ai/dsh-client-store'
import { deriveAgentFlow, emptyAgentFlow, type AgentFlowSnapshot } from './derive-flow.ts'
import type { NavActions, NavState } from './nav-store.ts'

/** Live Observe navigation instance (subscribe + `focusTurn` projection). */
export type ObserveNavInstance = StoreInstance<NavState, NavActions>

/**
 * Subscribe to Session events, lifecycle, and nav `focusTurn`; project an Agent flow graph.
 * Subscriptions live for the source object's lifetime (one per Session binding).
 * @param binding - Client Session binding for the Agent under inspection.
 * @param nav - shared Observe nav instance for this Session (deduped via the store handle).
 * @returns bare observable consumed via inject `hooks.agentFlow`.
 */
export function createAgentFlowSource(
  binding: SessionBinding,
  nav: ObserveNavInstance,
): ObservableSnapshot<AgentFlowSnapshot> {
  let snapshot = project(binding, nav)
  const listeners = new Set<() => void>()

  const refresh = (): void => {
    snapshot = project(binding, nav)
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error: unknown) {
        console.error('agent-observe: agentFlow listener failed', error)
      }
    }
  }

  binding.eventSource.subscribe(refresh)
  binding.session.subscribe(refresh)
  nav.subscribe(refresh)

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

function project(binding: SessionBinding, nav: ObserveNavInstance): AgentFlowSnapshot {
  try {
    return deriveAgentFlow(
      binding.eventSource.getSnapshot(),
      binding.session.getSnapshot(),
      nav.getSnapshot().focusTurn,
    )
  } catch (error: unknown) {
    console.error('agent-observe: deriveAgentFlow failed', error)
    return emptyAgentFlow()
  }
}
