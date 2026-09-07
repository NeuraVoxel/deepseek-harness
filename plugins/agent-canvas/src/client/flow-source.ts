/**
 * Observable Agent flow snapshot bound to one Session's event window.
 */

import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { deriveAgentFlow, emptyAgentFlow, type AgentFlowSnapshot } from './derive-flow.ts'

/**
 * Subscribe to Session events + lifecycle and project an Agent flow graph.
 * Subscriptions live for the source object's lifetime (one per Session binding).
 * @param binding - Client Session binding for the Agent under inspection.
 * @returns bare observable consumed via inject `hooks.agentFlow`.
 */
export function createAgentFlowSource(binding: SessionBinding): ObservableSnapshot<AgentFlowSnapshot> {
  let snapshot = project(binding)
  const listeners = new Set<() => void>()

  const refresh = (): void => {
    snapshot = project(binding)
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error: unknown) {
        console.error('agent-canvas: agentFlow listener failed', error)
      }
    }
  }

  binding.eventSource.subscribe(refresh)
  binding.session.subscribe(refresh)

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

function project(binding: SessionBinding): AgentFlowSnapshot {
  try {
    return deriveAgentFlow(binding.eventSource.getSnapshot(), binding.session.getSnapshot())
  } catch (error: unknown) {
    console.error('agent-canvas: deriveAgentFlow failed', error)
    return emptyAgentFlow()
  }
}
