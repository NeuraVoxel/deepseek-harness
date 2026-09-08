/**
 * Observable composition activity bound to one Session.
 */

import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import {
  deriveCompositionActivity,
  emptyCompositionActivity,
  type CompositionActivity,
} from './derive-activity.ts'

/**
 * Subscribe to Session events / lifecycle / agentPreset projection.
 * Subscriptions live for the source object's lifetime (one per Session binding).
 * @param binding - Client Session binding.
 * @returns bare observable for inject `hooks.compositionActivity`.
 */
export function createCompositionActivitySource(
  binding: SessionBinding,
): ObservableSnapshot<CompositionActivity> {
  let snapshot = project(binding)
  const listeners = new Set<() => void>()

  const refresh = (): void => {
    snapshot = project(binding)
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error: unknown) {
        console.error('agent-orchestrator: compositionActivity listener failed', error)
      }
    }
  }

  binding.eventSource.subscribe(refresh)
  binding.session.subscribe(refresh)
  binding.session.projections.faceOf('agentPreset').subscribe(refresh)

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

function project(binding: SessionBinding): CompositionActivity {
  try {
    const presetRaw = binding.session.projections.faceOf('agentPreset').getSnapshot()
    const sessionPresetId = typeof presetRaw === 'string' ? presetRaw : null
    return deriveCompositionActivity(
      binding.eventSource.getSnapshot(),
      binding.session.getSnapshot(),
      sessionPresetId,
    )
  } catch (error: unknown) {
    console.error('agent-orchestrator: deriveCompositionActivity failed', error)
    return emptyCompositionActivity()
  }
}
