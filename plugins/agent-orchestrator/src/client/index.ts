/**
 * Agent Orchestrator plugin — browser half.
 *
 * Registers an Orchestrate tab on the conversation view ring. Loads
 * composition via remote.pluginInventory.list and highlights units whose
 * tools are in flight on the current Session (observe stays on flow/data).
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  emptyCompositionActivity,
  OrchestratorView,
  type OrchestratorViewInjected,
} from './OrchestratorView.tsx'
import { createCompositionActivitySource } from './activity-source.ts'
import type { CompositionActivity } from './derive-activity.ts'
import { en, NS, zh, type AgentOrchestratorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent Orchestrator copy. */
    'agent-orchestrator': AgentOrchestratorKey
  }
}

/** Required services for slot registration, locale, inventory, and Session binding. */
export const inject = ['slots', 'locale', 'remote', 'remote.pluginInventory', 'sessions']

/**
 * Client plugin body: dictionaries + Orchestrate conversation tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agent-orchestrator: dictionaries')
  const t = ctx.locale.bind(NS)

  const listInventory: OrchestratorViewInjected['listInventory'] = async () => {
    const result = await ctx.remote.pluginInventory.list()
    if (!result.ok) {
      throw new Error(`pluginInventory.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }

  const activitySources = new WeakMap<SessionBinding, ObservableSnapshot<CompositionActivity>>()
  const emptyActivity: ObservableSnapshot<CompositionActivity> = {
    getSnapshot: () => emptyCompositionActivity(),
    subscribe: () => () => {},
  }

  const activitySource = (binding: SessionBinding | undefined): ObservableSnapshot<CompositionActivity> => {
    if (binding === undefined) return emptyActivity
    let source = activitySources.get(binding)
    if (source === undefined) {
      source = createCompositionActivitySource(binding)
      activitySources.set(binding, source)
    }
    return source
  }

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'orchestrator',
    order: 25,
    locale: NS,
    label: () => t('view.orchestrator'),
    inject: (sessionId: SessionId): OrchestratorViewInjected => {
      const binding = ctx.sessions.binding(sessionId)
      return {
        listInventory,
        hooks: { compositionActivity: activitySource(binding) },
      }
    },
  }, OrchestratorView))
}
