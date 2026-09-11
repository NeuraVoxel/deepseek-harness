/**
 * Agent Observe plugin — browser half.
 *
 * Registers an Observe tab on the conversation view ring (alongside Chat and
 * Trajectory), plus a per-Turn shortcut on `conversation.chat.assistant-actions`
 * (beside Turn usage) that opens that tab. Fleet overview lists Agents;
 * double-click opens a process topology for the current Agent's latest turn.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import { ObserveView, type ObserveViewInjected } from './ObserveView.tsx'
import { ViewShortcut, type ViewShortcutInjected } from './ViewShortcut.tsx'
import { createAgentFlowSource, type ObserveNavInstance } from './flow-source.ts'
import type { AgentFlowSnapshot } from './derive-flow.ts'
import { emptyAgentFlow } from './derive-flow.ts'
import { createObserveNavStore } from './nav-store.ts'
import { openConversationViewTab } from './open-view-tab.ts'
import { resolveTurnFromMessageId } from './resolve-turn.ts'
import { en, NS, zh, type AgentObserveKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent Observe copy. */
    'agent-observe': AgentObserveKey
  }
}

/** Required services for slot registration, session open, and dictionaries. */
export const inject = ['slots', 'locale', 'sessions']

/**
 * Client plugin body: dictionaries, Observe conversation tab, per-Turn shortcut.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agent-observe: dictionaries')
  const t = ctx.locale.bind(NS)
  const navStore = createObserveNavStore()
  const flowSources = new WeakMap<SessionBinding, ObservableSnapshot<AgentFlowSnapshot>>()
  const emptyFlow: ObservableSnapshot<AgentFlowSnapshot> = {
    getSnapshot: () => emptyAgentFlow(),
    subscribe: () => () => {},
  }
  const emptyWindow: ObservableSnapshot<SessionEventWindow> = {
    getSnapshot: () => ({
      entries: [],
      hasMore: false,
      revision: 0,
      change: { kind: 'replace', entries: [] },
    }),
    subscribe: () => () => {},
  }
  const emptySessionLife: ObservableSnapshot<SessionSnapshot> = {
    getSnapshot: () => ({
      sessionId: '' as SessionId,
      queue: [],
      pendingSubmissions: [],
      running: false,
      subagent: null,
      removed: false,
      openState: 'cold',
      openError: null,
      hasMore: false,
      loadingOlder: false,
      promptError: null,
      blank: true,
      lastAgentError: null,
      promptAttempted: false,
      awaitingFirstTurn: false,
    }) as SessionSnapshot,
    subscribe: () => () => {},
  }

  const flowSource = (
    binding: SessionBinding | undefined,
    nav: ObserveNavInstance,
  ): ObservableSnapshot<AgentFlowSnapshot> => {
    if (binding === undefined) return emptyFlow
    let source = flowSources.get(binding)
    if (source === undefined) {
      source = createAgentFlowSource(binding, nav)
      flowSources.set(binding, source)
    }
    return source
  }

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'observe',
    order: 20,
    locale: NS,
    label: () => t('view.observe'),
    store: navStore,
    inject: (sessionId: SessionId, _actions): ObserveViewInjected => {
      const binding = ctx.sessions.binding(sessionId)
      const nav = navStore.create(sessionId)
      return {
        openSession: (id) => { ctx.sessions.open(id) },
        hooks: {
          agentFlow: flowSource(binding, nav),
          eventWindow: binding?.eventSource ?? emptyWindow,
          sessionLife: binding?.session ?? emptySessionLife,
        },
      }
    },
  }, ObserveView))

  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'agent-observe',
    order: 30,
    locale: NS,
    inject: (sessionId): ViewShortcutInjected => ({
      openObserveFlow: (messageId) => {
        const binding = ctx.sessions.binding(sessionId)
        const turn = binding === undefined
          ? undefined
          : resolveTurnFromMessageId(binding.eventSource.getSnapshot(), messageId)
        const nav = navStore.create(sessionId)
        if (turn === undefined) nav.actions.showFlow()
        else nav.actions.showFlow(turn)
        openConversationViewTab(t('view.observe'))
      },
    }),
  }, ViewShortcut))
}
